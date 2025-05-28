FROM python:3.13.3-slim
WORKDIR /opt/render/project/src
COPY . .
RUN pip install -r requirements.txt
CMD ["./run.sh"]
