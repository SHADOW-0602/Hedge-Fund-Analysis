import os
from dotenv import load_dotenv
from perplexity import Perplexity

load_dotenv()

client = Perplexity()

system_prompt = """You are an expert research assistant specializing in technology and science. 
Always provide well-sourced, accurate information and cite your sources. 
Format your responses with clear headings and bullet points when appropriate."""

completion = client.chat.completions.create(
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Explain quantum computing applications"}
    ],
    model="sonar-pro"
)
print(f"Response: {completion.choices[0].message.content}")