# System Requirements

Before you begin, ensure you have the following installed on your system:

#### Python 3.8+

#### Docker and Docker Compose (for running the database)

## Installation

Clone the repository:
```
git clone https://github.com/mkm72/Motari.git
cd motari
```

Set up a Virtual Environment:

# Create virtual environment
```
python -m venv venv
```
# Activate virtual environment


## On Windows:
```
venv\Scripts\activate
```
## On macOS/Linux:
```
source venv/bin/activate
```

Install Dependencies:
Install the required Python packages listed in requirements.txt.
```
pip install -r requirements.txt
```


# How to Run

1. Start the Database

This project uses a MongoDB container defined in docker-compose.yml. You must start this container before running the Flask application.

Run the following command in the project root:
```
docker-compose up -d
```


This will start a MongoDB container named ```motarilog_db```.

The database listens on port ```27017```.

Data is persisted in a docker volume named ```motarilog-data```.

2. Start the Flask Application

Once the database is running, you can start the Python backend.
```
python run.py
```


The application will start in debug mode and will be accessible at:
```http://localhost:5000```





