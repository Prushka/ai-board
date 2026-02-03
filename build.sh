#!/bin/bash

# Build the image
docker build -t meinya/ai-board:latest .

# Push to Docker Hub
docker push meinya/ai-board:latest
