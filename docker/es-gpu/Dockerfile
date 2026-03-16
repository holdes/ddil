FROM docker.elastic.co/elasticsearch/elasticsearch:9.3.1

USER root

# Copy aarch64-built cuVS Java JAR (replaces x86_64 version)
COPY cuvs-java-25.12.0.jar /usr/share/elasticsearch/modules/gpu/cuvs-java-25.12.0.jar

# Native cuVS libs will be bind-mounted at /opt/cuvs/lib at runtime
# CUDA libs provided by --gpus all (NVIDIA Container Toolkit)
ENV LD_LIBRARY_PATH="/opt/cuvs/lib:/usr/local/cuda/lib64:${LD_LIBRARY_PATH}"
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

USER elasticsearch
