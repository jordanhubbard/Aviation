FROM python:3.9-slim

WORKDIR /app

COPY apps/flightschool/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/flightschool/ .

CMD [ "python", "app.py" ]