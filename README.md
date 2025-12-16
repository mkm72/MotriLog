# MotariLog

MotariLog is a smart vehicle maintenance tracker that helps users monitor service history, predict maintenance needs, and locate nearby workshops.
As a final project for a Software Engineering (SWE) course.

## System Requirements

Ensure you have the following installed on your system:
* [Python 3.9+](https://www.python.org/)
* [Docker and Docker Compose](https://docs.docker.com/desktop/setup/install/windows-install/)

---

## Installation

1.  **Clone the repository:**
    ```bash
    git clone --branch=develop https://github.com/mkm72/Motari.git
    cd Motari
    ```

2.  **Configuration:**
    The application is configured to run out-of-the-box with default settings.
    * **Database:** Connects to MongoDB via Docker service `mongo` (internal) or `localhost` (local dev).
    * **Maps:** Uses Leaflet.js with OpenStreetMap. This requires the admin to pin locations manually (see section below) instead of using a paid API key.

---

## How to Run

You can run the application in two ways: **Full Docker Mode** (recommended) or **Local Development Mode**.

### Option 1: Full Docker Mode (Recommended)
This starts both the MongoDB database and the Flask backend in synchronized containers.

1.  **Build and Start:**
    ```bash
    docker-compose up --build
    ```
2.  **Access the App:**
    Open your browser to: `http://127.0.0.1:5000`
    
    > **Note:** Use `127.0.0.1` instead of `localhost` to ensure authentication cookies work correctly.

### Option 2: Local Development Mode
Use this if you want to edit Python code and see changes without rebuilding Docker containers.

1.  **Start ONLY the Database:**
    ```bash
    docker-compose up -d mongo
    ```
    *This starts MongoDB on port `27017`.*

2.  **Set up Python Environment:**
    ```bash
    # Create virtual environment
    python -m venv venv

    # Activate virtual environment
    # Windows:
    venv\Scripts\activate
    # macOS/Linux:
    source venv/bin/activate
    ```

3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the Application:**
    ```bash
    # Ensure Flask knows to connect to localhost, not the docker service name
    # Linux/Mac:
    export MONGO_URI="mongodb://localhost:27017/motarilog"
    # Windows CMD:
    set MONGO_URI=mongodb://localhost:27017/motarilog

    python run.py
    ```
    The application will start in debug mode at `http://127.0.0.1:5000`.

---

## Admin Access & Workshop Management

The system automatically creates a default administrator account on the first launch. This account has exclusive access to manage workshop locations on the map.

**Default Credentials:**
* **Email:** `admin@motarilog.com`
* **Password:** `admin123`

