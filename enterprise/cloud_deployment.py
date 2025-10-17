import os
import yaml
from typing import Dict, List, Optional
import docker
import boto3
from kubernetes import client, config
import json

class DockerManager:
    def __init__(self):
        self.client = docker.from_env()
    
    def create_dockerfile(self, service_name: str) -> str:
        """Create Dockerfile for hedge fund services"""
        
        dockerfile_content = f"""
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    g++ \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:5000/health || exit 1

# Run application
CMD ["python", "enterprise/api_server.py"]
"""
        
        with open(f"Dockerfile.{service_name}", "w") as f:
            f.write(dockerfile_content)
        
        return f"Dockerfile.{service_name}"
    
    def build_image(self, service_name: str, tag: str = "latest") -> str:
        """Build Docker image for service"""
        
        dockerfile_path = self.create_dockerfile(service_name)
        
        image_name = f"hedge-fund-{service_name}:{tag}"
        
        try:
            image, logs = self.client.images.build(
                path=".",
                dockerfile=dockerfile_path,
                tag=image_name,
                rm=True
            )
            
            return image_name
        except Exception as e:
            raise Exception(f"Failed to build image: {str(e)}")
    
    def create_docker_compose(self) -> str:
        """Create docker-compose.yml for multi-service deployment"""
        
        compose_config = {
            'version': '3.8',
            'services': {
                'api-server': {
                    'build': {
                        'context': '.',
                        'dockerfile': 'Dockerfile.api'
                    },
                    'ports': ['5000:5000'],
                    'environment': [
                        'FLASK_ENV=production',
                        'DATABASE_URL=postgresql://user:pass@db:5432/hedgefund'
                    ],
                    'depends_on': ['db', 'redis'],
                    'restart': 'unless-stopped'
                },
                'db': {
                    'image': 'postgres:13',
                    'environment': [
                        'POSTGRES_DB=hedgefund',
                        'POSTGRES_USER=user',
                        'POSTGRES_PASSWORD=pass'
                    ],
                    'volumes': ['postgres_data:/var/lib/postgresql/data'],
                    'restart': 'unless-stopped'
                },
                'redis': {
                    'image': 'redis:6-alpine',
                    'restart': 'unless-stopped'
                },
                'nginx': {
                    'image': 'nginx:alpine',
                    'ports': ['80:80', '443:443'],
                    'volumes': ['./nginx.conf:/etc/nginx/nginx.conf'],
                    'depends_on': ['api-server'],
                    'restart': 'unless-stopped'
                }
            },
            'volumes': {
                'postgres_data': {}
            }
        }
        
        with open('docker-compose.yml', 'w') as f:
            yaml.dump(compose_config, f, default_flow_style=False)
        
        return 'docker-compose.yml'

class KubernetesManager:
    def __init__(self):
        try:
            config.load_incluster_config()  # For in-cluster deployment
        except:
            config.load_kube_config()  # For local development
        
        self.v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
    
    def create_deployment_manifest(self, service_name: str, 
                                 image_name: str, replicas: int = 3) -> Dict:
        """Create Kubernetes deployment manifest"""
        
        deployment = {
            'apiVersion': 'apps/v1',
            'kind': 'Deployment',
            'metadata': {
                'name': f'hedge-fund-{service_name}',
                'labels': {
                    'app': f'hedge-fund-{service_name}',
                    'tier': 'backend'
                }
            },
            'spec': {
                'replicas': replicas,
                'selector': {
                    'matchLabels': {
                        'app': f'hedge-fund-{service_name}'
                    }
                },
                'template': {
                    'metadata': {
                        'labels': {
                            'app': f'hedge-fund-{service_name}'
                        }
                    },
                    'spec': {
                        'containers': [{
                            'name': service_name,
                            'image': image_name,
                            'ports': [{'containerPort': 5000}],
                            'env': [
                                {'name': 'DATABASE_URL', 'value': 'postgresql://user:pass@postgres:5432/hedgefund'},
                                {'name': 'REDIS_URL', 'value': 'redis://redis:6379'}
                            ],
                            'resources': {
                                'requests': {
                                    'memory': '256Mi',
                                    'cpu': '250m'
                                },
                                'limits': {
                                    'memory': '512Mi',
                                    'cpu': '500m'
                                }
                            },
                            'livenessProbe': {
                                'httpGet': {
                                    'path': '/health',
                                    'port': 5000
                                },
                                'initialDelaySeconds': 30,
                                'periodSeconds': 10
                            },
                            'readinessProbe': {
                                'httpGet': {
                                    'path': '/health',
                                    'port': 5000
                                },
                                'initialDelaySeconds': 5,
                                'periodSeconds': 5
                            }
                        }]
                    }
                }
            }
        }
        
        return deployment
    
    def create_service_manifest(self, service_name: str) -> Dict:
        """Create Kubernetes service manifest"""
        
        service = {
            'apiVersion': 'v1',
            'kind': 'Service',
            'metadata': {
                'name': f'hedge-fund-{service_name}-service',
                'labels': {
                    'app': f'hedge-fund-{service_name}'
                }
            },
            'spec': {
                'selector': {
                    'app': f'hedge-fund-{service_name}'
                },
                'ports': [{
                    'protocol': 'TCP',
                    'port': 80,
                    'targetPort': 5000
                }],
                'type': 'LoadBalancer'
            }
        }
        
        return service
    
    def create_configmap(self, config_data: Dict) -> Dict:
        """Create ConfigMap for application configuration"""
        
        configmap = {
            'apiVersion': 'v1',
            'kind': 'ConfigMap',
            'metadata': {
                'name': 'hedge-fund-config'
            },
            'data': {k: str(v) for k, v in config_data.items()}
        }
        
        return configmap
    
    def deploy_to_kubernetes(self, service_name: str, image_name: str):
        """Deploy service to Kubernetes cluster"""
        
        # Create deployment
        deployment = self.create_deployment_manifest(service_name, image_name)
        self.apps_v1.create_namespaced_deployment(
            body=deployment,
            namespace='default'
        )
        
        # Create service
        service = self.create_service_manifest(service_name)
        self.v1.create_namespaced_service(
            body=service,
            namespace='default'
        )
        
        return f"Deployed {service_name} to Kubernetes"

class AWSManager:
    def __init__(self, region: str = 'us-east-1'):
        self.region = region
        self.ecs_client = boto3.client('ecs', region_name=region)
        self.ec2_client = boto3.client('ec2', region_name=region)
        self.rds_client = boto3.client('rds', region_name=region)
        self.s3_client = boto3.client('s3', region_name=region)
    
    def create_ecs_cluster(self, cluster_name: str = 'hedge-fund-cluster'):
        """Create ECS cluster for containerized deployment"""
        
        try:
            response = self.ecs_client.create_cluster(
                clusterName=cluster_name,
                capacityProviders=['FARGATE', 'EC2'],
                defaultCapacityProviderStrategy=[
                    {
                        'capacityProvider': 'FARGATE',
                        'weight': 1
                    }
                ]
            )
            
            return response['cluster']['clusterArn']
        except Exception as e:
            raise Exception(f"Failed to create ECS cluster: {str(e)}")
    
    def create_task_definition(self, service_name: str, image_uri: str) -> str:
        """Create ECS task definition"""
        
        task_definition = {
            'family': f'hedge-fund-{service_name}',
            'networkMode': 'awsvpc',
            'requiresCompatibilities': ['FARGATE'],
            'cpu': '256',
            'memory': '512',
            'executionRoleArn': 'arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole',
            'containerDefinitions': [
                {
                    'name': service_name,
                    'image': image_uri,
                    'portMappings': [
                        {
                            'containerPort': 5000,
                            'protocol': 'tcp'
                        }
                    ],
                    'environment': [
                        {'name': 'AWS_REGION', 'value': self.region},
                        {'name': 'ENVIRONMENT', 'value': 'production'}
                    ],
                    'logConfiguration': {
                        'logDriver': 'awslogs',
                        'options': {
                            'awslogs-group': f'/ecs/hedge-fund-{service_name}',
                            'awslogs-region': self.region,
                            'awslogs-stream-prefix': 'ecs'
                        }
                    }
                }
            ]
        }
        
        response = self.ecs_client.register_task_definition(**task_definition)
        return response['taskDefinition']['taskDefinitionArn']
    
    def create_rds_instance(self, db_name: str = 'hedgefund'):
        """Create RDS PostgreSQL instance"""
        
        try:
            response = self.rds_client.create_db_instance(
                DBInstanceIdentifier=f'{db_name}-db',
                DBInstanceClass='db.t3.micro',
                Engine='postgres',
                MasterUsername='hedgefund',
                MasterUserPassword='SecurePassword123!',
                AllocatedStorage=20,
                VpcSecurityGroupIds=['sg-12345678'],  # Replace with actual security group
                DBSubnetGroupName='default',
                BackupRetentionPeriod=7,
                MultiAZ=False,
                PubliclyAccessible=False,
                StorageEncrypted=True
            )
            
            return response['DBInstance']['DBInstanceArn']
        except Exception as e:
            raise Exception(f"Failed to create RDS instance: {str(e)}")
    
    def create_s3_bucket(self, bucket_name: str):
        """Create S3 bucket for data storage"""
        
        try:
            if self.region == 'us-east-1':
                self.s3_client.create_bucket(Bucket=bucket_name)
            else:
                self.s3_client.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': self.region}
                )
            
            # Enable versioning
            self.s3_client.put_bucket_versioning(
                Bucket=bucket_name,
                VersioningConfiguration={'Status': 'Enabled'}
            )
            
            # Enable encryption
            self.s3_client.put_bucket_encryption(
                Bucket=bucket_name,
                ServerSideEncryptionConfiguration={
                    'Rules': [
                        {
                            'ApplyServerSideEncryptionByDefault': {
                                'SSEAlgorithm': 'AES256'
                            }
                        }
                    ]
                }
            )
            
            return f"s3://{bucket_name}"
        except Exception as e:
            raise Exception(f"Failed to create S3 bucket: {str(e)}")

class TerraformManager:
    def __init__(self):
        pass
    
    def generate_terraform_config(self) -> str:
        """Generate Terraform configuration for infrastructure"""
        
        terraform_config = """
# Terraform configuration for Hedge Fund Analysis Platform

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# VPC
resource "aws_vpc" "hedge_fund_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "hedge-fund-vpc"
    Environment = var.environment
  }
}

# Subnets
resource "aws_subnet" "private_subnet" {
  count             = 2
  vpc_id            = aws_vpc.hedge_fund_vpc.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "hedge-fund-private-subnet-${count.index + 1}"
    Environment = var.environment
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "hedge_fund_cluster" {
  name = "hedge-fund-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = var.environment
  }
}

# RDS Instance
resource "aws_db_instance" "hedge_fund_db" {
  identifier     = "hedge-fund-db"
  engine         = "postgres"
  engine_version = "13.7"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  
  db_name  = "hedgefund"
  username = "hedgefund"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.hedge_fund_db_subnet_group.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = true
  
  tags = {
    Environment = var.environment
  }
}

# S3 Bucket for data storage
resource "aws_s3_bucket" "hedge_fund_data" {
  bucket = "hedge-fund-data-${random_string.bucket_suffix.result}"

  tags = {
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "hedge_fund_data_versioning" {
  bucket = aws_s3_bucket.hedge_fund_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "hedge_fund_data_encryption" {
  bucket = aws_s3_bucket.hedge_fund_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Random string for unique bucket naming
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# Outputs
output "ecs_cluster_name" {
  value = aws_ecs_cluster.hedge_fund_cluster.name
}

output "rds_endpoint" {
  value = aws_db_instance.hedge_fund_db.endpoint
}

output "s3_bucket_name" {
  value = aws_s3_bucket.hedge_fund_data.bucket
}
"""
        
        with open('main.tf', 'w') as f:
            f.write(terraform_config)
        
        return 'main.tf'

class CloudDeploymentOrchestrator:
    def __init__(self, platform: str = 'aws'):
        self.platform = platform
        self.docker_manager = DockerManager()
        
        if platform == 'aws':
            self.cloud_manager = AWSManager()
        elif platform == 'kubernetes':
            self.kubernetes_manager = KubernetesManager()
    
    def deploy_full_stack(self, services: List[str]) -> Dict:
        """Deploy complete hedge fund platform"""
        
        deployment_results = {}
        
        # Build Docker images
        for service in services:
            try:
                image_name = self.docker_manager.build_image(service)
                deployment_results[service] = {
                    'image_built': True,
                    'image_name': image_name
                }
            except Exception as e:
                deployment_results[service] = {
                    'image_built': False,
                    'error': str(e)
                }
        
        # Deploy to cloud platform
        if self.platform == 'aws':
            cluster_arn = self.cloud_manager.create_ecs_cluster()
            deployment_results['infrastructure'] = {
                'cluster_created': True,
                'cluster_arn': cluster_arn
            }
        
        # Create docker-compose for local development
        compose_file = self.docker_manager.create_docker_compose()
        deployment_results['local_deployment'] = {
            'compose_file': compose_file
        }
        
        return deployment_results