# St. Jude Medical — Hospital Command Dashboard

A real-time hospital resource management dashboard built with:
- **Flask** — Python web framework
- **Flask-SocketIO** — WebSockets for live data push
- **MongoDB** — Persistent data storage
- **Vanilla HTML/CSS/JS** — No frontend framework needed
- **Chart.js** — Occupancy forecast chart

---

## 📁 Project Structure

```
hospital-dashboard/
├── app.py                   # Flask app + SocketIO + MongoDB
├── requirements.txt
├── templates/
│   └── index.html           # Main dashboard UI
└── static/
    ├── css/style.css        # All styles
    └── js/dashboard.js      # Socket.io client + Chart.js
```

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Start MongoDB (optional — app runs with mock data if MongoDB isn't available)

```bash
mongod --dbpath /data/db
```

### 3. Run the app

```bash
python app.py
```

### 4. Open in browser

```
http://localhost:5000
```

---

## ⚡ Real-time Features

| Event | Direction | Description |
|---|---|---|
| `connect` | server → client | Push all current data on connect |
| `resources_update` | server → client | Resource list (beds, ICU, vents) |
| `emergency_update` | server → client | ICU %, ventilator %, staffing |
| `predictions_update` | server → client | Forecast data + threshold alerts |
| `request_refresh` | client → server | Manual data refresh trigger |

The server broadcasts `emergency_update` and `predictions_update` **every 5 seconds** with simulated fluctuations, mimicking live sensor feeds.

---

## 🗄️ MongoDB Collections

| Collection | Contents |
|---|---|
| `resources` | Beds, ICU rooms, ventilators, equipment |
| `emergency` | Live capacity metrics, staffing, lockdown |
| `predictions` | AI forecast data + threshold alerts |

The app seeds initial data automatically on first run.

---

## 🔧 Configuration

Edit `app.py` to:
- Change the MongoDB URI (`mongodb://localhost:27017/`)
- Adjust the broadcast interval (default: 5 seconds)
- Add authentication or additional Socket.io rooms per ward
