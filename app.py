from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
import threading, time, random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'kingsway-hospital-secret-2024'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ── MongoDB Connection ────────────────────────────────────────
try:
    client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=2000)
    client.server_info()
    db = client['kingsway_hospital_db']
    USE_MONGO = True
    print("✅ Connected to MongoDB: kingsway_hospital_db")
except Exception as e:
    print(f"⚠️  MongoDB unavailable, using in-memory store: {e}")
    USE_MONGO = False

# ── Seed Data ─────────────────────────────────────────────────
SEED = {
  "resources": [
    {"id":"bed_101", "name":"Bed 101",        "type":"bed",        "department":"Standard Care","status":"available",  "note":"Ready for intake"},
    {"id":"icu_4",   "name":"ICU Room 4",      "type":"icu",        "department":"Critical Care","status":"occupied",   "note":"High Priority"},
    {"id":"vent_a12","name":"Ventilator A-12", "type":"ventilator", "department":"Portable Unit","status":"in_use",     "note":"Low Battery"},
    {"id":"bed_102", "name":"Bed 102",         "type":"bed",        "department":"Standard Care","status":"sanitizing", "note":"Est. 10 mins"},
    {"id":"xray_1",  "name":"X-Ray Room 1",   "type":"xray",       "department":"Radiology",    "status":"processing", "note":"Next: 2:00 PM"},
    {"id":"icu_6",   "name":"ICU Room 6",      "type":"icu",        "department":"Critical Care","status":"occupied",   "note":"Critical"},
    {"id":"bed_103", "name":"Bed 103",         "type":"bed",        "department":"Standard Care","status":"available",  "note":"Clean"},
  ],
  "units": [
    {"id":"u1","name":"ICU Wing A",     "dept":"Intensive Care","icon":"🏥","category":"icu",      "beds":12,"occupied":11,"staff":18,"status":"critical"},
    {"id":"u2","name":"Emergency Room", "dept":"Emergency",     "icon":"🚨","category":"emergency","beds":20,"occupied":16,"staff":24,"status":"warning"},
    {"id":"u3","name":"Radiology Suite","dept":"Diagnostics",   "icon":"🩻","category":"radiology","beds":6, "occupied":3, "staff":8, "status":"ok"},
    {"id":"u4","name":"Standard Ward B","dept":"General Care",  "icon":"🛏","category":"standard", "beds":30,"occupied":22,"staff":15,"status":"warning"},
    {"id":"u5","name":"Surgical Unit",  "dept":"Surgery",       "icon":"🔬","category":"icu",      "beds":8, "occupied":5, "staff":20,"status":"ok"},
    {"id":"u6","name":"Cardiac Care",   "dept":"Cardiology",    "icon":"❤️","category":"icu",      "beds":10,"occupied":9, "staff":16,"status":"critical"},
    {"id":"u7","name":"Neonatal ICU",   "dept":"Neonatology",   "icon":"🍼","category":"icu",      "beds":6, "occupied":4, "staff":10,"status":"ok"},
  ],
  "inventory": [
    {"id":"i1", "name":"Ventilators",      "stock":16,  "status":"not_available"},
    {"id":"i2", "name":"ICU Beds",         "stock":3,   "status":"not_available"},
    {"id":"i3", "name":"PPE Kits",         "stock":45,  "status":"low"},
    {"id":"i4", "name":"Surgical Gloves",  "stock":280, "status":"low"},
    {"id":"i5", "name":"Oxygen Cylinders", "stock":22,  "status":"low"},
    {"id":"i6", "name":"Syringes (10ml)",  "stock":1200,"status":"ok"},
    {"id":"i7", "name":"Blood Bags (O+)",  "stock":18,  "status":"low"},
    {"id":"i8", "name":"IV Fluids (500ml)","stock":340, "status":"ok"},
    {"id":"i9", "name":"Defibrillators",   "stock":8,   "status":"low"},
    {"id":"i10","name":"Surgical Masks",   "stock":900, "status":"ok"},
    {"id":"i11","name":"Patient Monitors", "stock":24,  "status":"ok"},
    {"id":"i12","name":"Wheelchairs",      "stock":35,  "status":"ok"},
    {"id":"i13","name":"Morphine (10mg)",  "stock":12,  "status":"not_available"},
    {"id":"i14","name":"Epinephrine",      "stock":8,   "status":"not_available"},
    {"id":"i15","name":"Bandages (sterile)","stock":600,"status":"ok"},
  ],
  "staff": [
    {"id":"s1", "name":"Dr. Rajesh Sharma",      "initials":"RS","role":"Senior Physician", "dept":"ICU",       "status":"on-duty", "shift":"07:00–19:00","phone":"+91-98201-11001","email":"r.sharma@kingsway.in"},
    {"id":"s2", "name":"Sr. Nurse Priya Nair",   "initials":"PN","role":"Head Nurse",       "dept":"Emergency", "status":"on-duty", "shift":"07:00–15:00","phone":"+91-98201-11002","email":"p.nair@kingsway.in"},
    {"id":"s3", "name":"Dr. Suresh Iyer",        "initials":"SI","role":"Surgeon",          "dept":"Surgery",   "status":"standby", "shift":"On Call",    "phone":"+91-98201-11003","email":"s.iyer@kingsway.in"},
    {"id":"s4", "name":"Dr. Meena Krishnan",     "initials":"MK","role":"ICU Specialist",   "dept":"ICU",       "status":"on-duty", "shift":"07:00–19:00","phone":"+91-98201-11004","email":"m.krishnan@kingsway.in"},
    {"id":"s5", "name":"Sr. Nurse Kavita Rao",   "initials":"KR","role":"ICU Nurse",        "dept":"ICU",       "status":"on-duty", "shift":"07:00–19:00","phone":"+91-98201-11005","email":"k.rao@kingsway.in"},
    {"id":"s6", "name":"Dr. Anand Verma",        "initials":"AV","role":"Radiologist",      "dept":"Radiology", "status":"on-duty", "shift":"08:00–16:00","phone":"+91-98201-11006","email":"a.verma@kingsway.in"},
    {"id":"s7", "name":"Sr. Nurse Sunita Desai", "initials":"SD","role":"ER Nurse",         "dept":"Emergency", "status":"standby", "shift":"On Call",    "phone":"+91-98201-11007","email":"s.desai@kingsway.in"},
    {"id":"s8", "name":"Dr. Pooja Agarwal",      "initials":"PA","role":"Cardiologist",     "dept":"Cardiac",   "status":"on-duty", "shift":"09:00–21:00","phone":"+91-98201-11008","email":"p.agarwal@kingsway.in"},
    {"id":"s9", "name":"Sr. Nurse Ravi Pillai",  "initials":"RP","role":"Night Nurse",      "dept":"Ward B",    "status":"off",     "shift":"21:00–07:00","phone":"+91-98201-11009","email":"r.pillai@kingsway.in"},
    {"id":"s10","name":"Dr. Deepa Menon",        "initials":"DM","role":"Pediatrician",     "dept":"Pediatrics","status":"off",     "shift":"19:00–07:00","phone":"+91-98201-11010","email":"d.menon@kingsway.in"},
    {"id":"s11","name":"Sr. Nurse Amit Joshi",   "initials":"AJ","role":"Surgical Nurse",   "dept":"Surgery",   "status":"standby", "shift":"On Call",    "phone":"+91-98201-11011","email":"a.joshi@kingsway.in"},
    {"id":"s12","name":"Dr. Vikram Nambiar",     "initials":"VN","role":"Anesthesiologist", "dept":"Surgery",   "status":"on-duty", "shift":"07:00–19:00","phone":"+91-98201-11012","email":"v.nambiar@kingsway.in"},
  ],
  "alerts": [
    {"id":"a1","severity":"critical","icon":"🏥","title":"ICU Capacity Critical",       "desc":"ICU has only 3 beds remaining. Diversion protocol recommended.","dept":"ICU",       "time":"2 min ago", "read":False},
    {"id":"a2","severity":"critical","icon":"💊","title":"Morphine Stock Critical",      "desc":"Morphine 10mg below threshold. Reorder required immediately.",  "dept":"Pharmacy",  "time":"8 min ago", "read":False},
    {"id":"a3","severity":"warning", "icon":"💨","title":"Ventilator Supply Low",        "desc":"Only 16 ventilators. Shortage predicted by 6:00 PM.",          "dept":"Equipment", "time":"15 min ago","read":False},
    {"id":"a4","severity":"critical","icon":"⚡","title":"Code Blue — Trauma Bay",       "desc":"Emergency response dispatched. All available staff report.",    "dept":"Emergency", "time":"22 min ago","read":False},
    {"id":"a5","severity":"warning", "icon":"🩸","title":"Blood Bank: O+ Running Low",   "desc":"O+ at 72% minimum. Contact regional blood bank.",              "dept":"Blood Bank","time":"35 min ago","read":True},
    {"id":"a6","severity":"info",    "icon":"📋","title":"Shift Change Reminder",        "desc":"Evening shift at 19:00. 45 staff scheduled for handover.",     "dept":"HR",        "time":"1 hr ago",  "read":True},
    {"id":"a7","severity":"warning", "icon":"🔧","title":"MRI Machine Maintenance",      "desc":"MRI Unit 2 maintenance at 20:00. Reroute to Unit 1.",          "dept":"Radiology", "time":"1 hr ago",  "read":True},
    {"id":"a8","severity":"info",    "icon":"📦","title":"Inventory Restocking Arriving","desc":"Supply delivery at Loading Bay 3, 16:00–17:00.",               "dept":"Supply",    "time":"2 hr ago",  "read":True},
  ],
  "emergency": {"id":"main","active":True,"icu_capacity":94,"icu_beds_active":42,"icu_beds_total":45,"ventilators_in_use":112,"ventilators_total":128,"zone_restricted":"Zone 4","staff_on_duty":142,"staff_standby":18},
  "predictions": {"id":"main","icu_full_minutes":45,"confidence":94,"peak_forecast_pct":98,"alerts":[
    {"icon":"ventilator","title":"Ventilator capacity predicted to drop below 10% by 6:00 PM","sub":"Resource allocation suggested"},
    {"icon":"staff","title":"Staffing shortage forecast in ER North Wing","sub":"Expected 7:30 PM (Confidence 78%)"},
  ]},
}

# ── In-Memory Store ───────────────────────────────────────────
import copy
MEM = copy.deepcopy(SEED)

# ── DB Helpers ────────────────────────────────────────────────
def c_find(col):
    if USE_MONGO: return [_c(d) for d in db[col].find()]
    return MEM[col]

def c_one(col, id_val):
    if USE_MONGO: return _c(db[col].find_one({'id': id_val}))
    return next((x for x in MEM[col] if x.get('id') == id_val), None)

def c_update(col, id_val, updates):
    if USE_MONGO:
        db[col].update_one({'id': id_val}, {'$set': updates})
        return _c(db[col].find_one({'id': id_val}))
    item = next((x for x in MEM[col] if x.get('id') == id_val), None)
    if item: item.update(updates)
    return item

def c_delete(col, id_val):
    if USE_MONGO: db[col].delete_one({'id': id_val})
    else: MEM[col] = [x for x in MEM[col] if x.get('id') != id_val]

def _c(doc):
    if doc and '_id' in doc: doc['_id'] = str(doc['_id'])
    return doc

def get_em():
    if USE_MONGO: return _c(db.emergency.find_one({'id':'main'})) or SEED['emergency']
    return MEM['emergency']

def get_pred():
    if USE_MONGO: return _c(db.predictions.find_one({'id':'main'})) or SEED['predictions']
    return MEM['predictions']

def seed_mongo():
    if not USE_MONGO: return
    for col in ['resources','units','inventory','staff','alerts']:
        if db[col].count_documents({}) == 0:
            db[col].insert_many(copy.deepcopy(SEED[col]))
    if db.emergency.count_documents({}) == 0: db.emergency.insert_one(copy.deepcopy(SEED['emergency']))
    if db.predictions.count_documents({}) == 0: db.predictions.insert_one(copy.deepcopy(SEED['predictions']))

seed_mongo()

# ── REST API ──────────────────────────────────────────────────
@app.route('/')
def index(): return render_template('index.html')

@app.route('/api/db-status')
def db_status():
    return jsonify({'connected': USE_MONGO, 'mode': 'MongoDB' if USE_MONGO else 'In-Memory',
        'collections': {k: len(c_find(k)) for k in ['resources','units','inventory','staff','alerts']}})

# Resources
@app.route('/api/resources')
def api_resources(): return jsonify(c_find('resources'))

@app.route('/api/resources/<rid>', methods=['PATCH'])
def patch_resource(rid):
    updated = c_update('resources', rid, request.json)
    socketio.emit('resources_update', c_find('resources'))
    return jsonify(updated)

# Units
@app.route('/api/units')
def api_units(): return jsonify(c_find('units'))

@app.route('/api/units/<uid>', methods=['PATCH'])
def patch_unit(uid):
    updated = c_update('units', uid, request.json)
    socketio.emit('units_update', c_find('units'))
    return jsonify(updated)

# Inventory
@app.route('/api/inventory')
def api_inventory(): return jsonify(c_find('inventory'))

@app.route('/api/inventory/<iid>', methods=['PATCH'])
def patch_inventory(iid):
    data = request.json
    if 'stock' in data and 'status' not in data:
        s = data['stock']
        data['status'] = 'not_available' if s < 10 else 'low' if s < 50 else 'ok'
    updated = c_update('inventory', iid, data)
    socketio.emit('inventory_update', c_find('inventory'))
    return jsonify(updated)

# Staff
@app.route('/api/staff')
def api_staff(): return jsonify(c_find('staff'))

@app.route('/api/staff/<sid>', methods=['PATCH'])
def patch_staff(sid):
    updated = c_update('staff', sid, request.json)
    socketio.emit('staff_update', c_find('staff'))
    return jsonify(updated)

# Alerts
@app.route('/api/alerts')
def api_alerts(): return jsonify(c_find('alerts'))

@app.route('/api/alerts/<aid>', methods=['PATCH'])
def patch_alert(aid):
    updated = c_update('alerts', aid, request.json)
    socketio.emit('alerts_update', c_find('alerts'))
    return jsonify(updated)

@app.route('/api/alerts/<aid>', methods=['DELETE'])
def del_alert(aid):
    c_delete('alerts', aid)
    socketio.emit('alerts_update', c_find('alerts'))
    return jsonify({'deleted': aid})

@app.route('/api/emergency')
def api_emergency(): return jsonify(get_em())

@app.route('/api/predictions')
def api_predictions(): return jsonify(get_pred())

# ── Socket.io ─────────────────────────────────────────────────
@socketio.on('connect')
def on_connect():
    for evt, fn in [('resources_update',c_find('resources')),('units_update',c_find('units')),
                    ('inventory_update',c_find('inventory')),('staff_update',c_find('staff')),
                    ('alerts_update',c_find('alerts')),('emergency_update',get_em()),
                    ('predictions_update',get_pred()),
                    ('db_status',{'connected':USE_MONGO,'mode':'MongoDB' if USE_MONGO else 'In-Memory'})]:
        emit(evt, fn)

@socketio.on('request_refresh')
def on_refresh():
    for evt, fn in [('resources_update',c_find('resources')),('units_update',c_find('units')),
                    ('inventory_update',c_find('inventory')),('staff_update',c_find('staff')),
                    ('alerts_update',c_find('alerts')),('emergency_update',get_em()),('predictions_update',get_pred())]:
        emit(evt, fn)

@socketio.on('update_resource_status')
def on_res(data):
    c_update('resources','id' if False else data['id'], {'status': data['status']})
    # fix: use id directly
    c_update('resources', data['id'], {'status': data['status']})
    socketio.emit('resources_update', c_find('resources'))

@socketio.on('update_staff_status')
def on_staff(data):
    c_update('staff', data['id'], {'status': data['status']})
    socketio.emit('staff_update', c_find('staff'))

@socketio.on('mark_alert_read')
def on_mark(data):
    c_update('alerts', data['id'], {'read': True})
    socketio.emit('alerts_update', c_find('alerts'))

@socketio.on('dismiss_alert')
def on_dismiss(data):
    c_delete('alerts', data['id'])
    socketio.emit('alerts_update', c_find('alerts'))

@socketio.on('update_inventory_stock')
def on_inv(data):
    s = data.get('stock', 0)
    status = 'not_available' if s < 10 else 'low' if s < 50 else 'ok'
    c_update('inventory', data['id'], {'stock': s, 'status': status})
    socketio.emit('inventory_update', c_find('inventory'))

# ── Live broadcast ────────────────────────────────────────────
def broadcast_loop():
    while True:
        time.sleep(5)
        if USE_MONGO:
            db.emergency.update_one({'id':'main'}, {'$inc':{'icu_capacity':random.randint(-1,2),'ventilators_in_use':random.randint(-2,3)}})
            em = get_em()
            em['icu_capacity'] = max(80, min(100, em['icu_capacity']))
            em['ventilators_in_use'] = max(90, min(128, em['ventilators_in_use']))
            db.emergency.replace_one({'id':'main'}, em)
        else:
            MEM['emergency']['icu_capacity'] = max(80, min(100, MEM['emergency']['icu_capacity'] + random.randint(-1,2)))
            MEM['emergency']['ventilators_in_use'] = max(90, min(128, MEM['emergency']['ventilators_in_use'] + random.randint(-2,3)))
        socketio.emit('emergency_update', get_em())
        socketio.emit('predictions_update', get_pred())

threading.Thread(target=broadcast_loop, daemon=True).start()

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)
