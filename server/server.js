// ===========================================================
// QC APP SERVER v1.0
// Part 1
// ===========================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");

const db = require("./db");

const {
    signToken,
    requireAuth,
    requireRole
} = require("./auth");

const app = express();

const PORT = process.env.PORT || 4000;

// ===========================================================
// Middlewares
// ===========================================================

app.use(cors());

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true
}));

// ===========================================================
// Health Check
// ===========================================================

app.get("/api/health",(req,res)=>{

    res.json({

        status:"OK",

        application:"QC APP",

        version:"1.0",

        time:new Date()

    });

});

// ===========================================================
// Authentication
// ===========================================================

// Login

app.post("/api/auth/login",(req,res)=>{

    const {

        username,

        password

    } = req.body;

    if(!username || !password){

        return res.status(400).json({

            error:"نام کاربری و رمز عبور الزامی است"

        });

    }

    const user=db.prepare(`

        SELECT *

        FROM users

        WHERE username=?

    `).get(username);

    if(!user){

        return res.status(401).json({

            error:"نام کاربری یا رمز عبور اشتباه است"

        });

    }

    const valid=bcrypt.compareSync(

        password,

        user.password_hash

    );

    if(!valid){

        return res.status(401).json({

            error:"نام کاربری یا رمز عبور اشتباه است"

        });

    }

    const token=signToken(user);

    res.json({

        token,

        user:{

            id:user.id,

            username:user.username,

            full_name:user.full_name,

            role:user.role

        }

    });

});


// Current User

app.get(

"/api/auth/me",

requireAuth,

(req,res)=>{

res.json({

user:req.user

});

});


// Change Password

app.put(

"/api/auth/password",

requireAuth,

(req,res)=>{

const{

currentPassword,

newPassword

}=req.body;

const user=db.prepare(

"SELECT * FROM users WHERE id=?"

).get(req.user.id);

const ok=bcrypt.compareSync(

currentPassword,

user.password_hash

);

if(!ok){

return res.status(400).json({

error:"رمز فعلی صحیح نیست"

});

}

const hash=bcrypt.hashSync(

newPassword,

10

);

db.prepare(`

UPDATE users

SET password_hash=?

WHERE id=?

`).run(

hash,

req.user.id

);

res.json({

ok:true

});

});

// ===========================================================
// User Management
// ===========================================================

// List Users

app.get(

"/api/users",

requireAuth,

requireRole("admin"),

(req,res)=>{

const rows=db.prepare(`

SELECT

id,

username,

full_name,

role,

active,

created_at

FROM users

ORDER BY full_name

`).all();

res.json(rows);

});


// Create User

app.post(

"/api/users",

requireAuth,

requireRole("admin"),

(req,res)=>{

const u=req.body;

if(

!u.username ||

!u.password ||

!u.full_name

){

return res.status(400).json({

error:"اطلاعات ناقص است"

});

}

const hash=bcrypt.hashSync(

u.password,

10

);

try{

const info=db.prepare(`

INSERT INTO users(

username,

password_hash,

full_name,

role,

active

)

VALUES(?,?,?,?,?)

`).run(

u.username,

hash,

u.full_name,

u.role || "inspector",

1

);

res.json({

id:info.lastInsertRowid

});

}

catch{

res.status(400).json({

error:"نام کاربری تکراری است"

});

}

});


// Delete User

app.delete(

"/api/users/:id",

requireAuth,

requireRole("admin"),

(req,res)=>{

db.prepare(

"DELETE FROM users WHERE id=?"

).run(

req.params.id

);

res.json({

ok:true

});

});

// ===========================================================
// ادامه در پارت 2 ...
// ===========================================================
// ===========================================================
// PRODUCTS
// ===========================================================

// لیست محصولات
app.get(
    "/api/products",
    requireAuth,
    (req, res) => {

        const rows = db.prepare(`
            SELECT *
            FROM products
            ORDER BY name
        `).all();

        res.json(rows);

    }
);

// دریافت یک محصول
app.get(
    "/api/products/:id",
    requireAuth,
    (req, res) => {

        const row = db.prepare(`
            SELECT *
            FROM products
            WHERE id=?
        `).get(req.params.id);

        if (!row)
            return res.status(404).json({
                error: "محصول پیدا نشد"
            });

        res.json(row);

    }
);

// ثبت محصول
app.post(
    "/api/products",
    requireAuth,
    requireRole("admin", "qc_manager"),
    (req, res) => {

        const p = req.body;

        if (!p.name)
            return res.status(400).json({
                error: "نام محصول الزامی است"
            });

        const id = p.id || ("prd_" + Date.now());

        db.prepare(`
            INSERT INTO products(
                id,
                name,
                technical_code,
                drawing_no,
                material,
                logo,
                image,
                description,
                active
            )
            VALUES(?,?,?,?,?,?,?,?,?)
        `).run(

            id,
            p.name,
            p.technical_code || "",
            p.drawing_no || "",
            p.material || "",
            p.logo || "",
            p.image || "",
            p.description || "",
            p.active === false ? 0 : 1

        );

        res.json({
            id
        });

    }
);

// ویرایش محصول
app.put(
    "/api/products/:id",
    requireAuth,
    requireRole("admin", "qc_manager"),
    (req, res) => {

        const p = req.body;

        db.prepare(`
            UPDATE products
            SET
                name=?,
                technical_code=?,
                drawing_no=?,
                material=?,
                logo=?,
                image=?,
                description=?,
                active=?
            WHERE id=?
        `).run(

            p.name,
            p.technical_code,
            p.drawing_no,
            p.material,
            p.logo,
            p.image,
            p.description,
            p.active ? 1 : 0,
            req.params.id

        );

        res.json({
            ok: true
        });

    }
);

// حذف محصول
app.delete(
    "/api/products/:id",
    requireAuth,
    requireRole("admin"),
    (req, res) => {

        db.prepare(`
            DELETE FROM products
            WHERE id=?
        `).run(req.params.id);

        res.json({
            ok: true
        });

    }
);

// ===========================================================
// PROCESSES
// ===========================================================

// لیست فرآیندها
app.get(
    "/api/processes",
    requireAuth,
    (req, res) => {

        const rows = db.prepare(`
            SELECT *
            FROM processes
            ORDER BY sort_order,name
        `).all();

        res.json(rows);

    }
);

// دریافت یک فرآیند
app.get(
    "/api/processes/:id",
    requireAuth,
    (req, res) => {

        const row = db.prepare(`
            SELECT *
            FROM processes
            WHERE id=?
        `).get(req.params.id);

        if (!row)
            return res.status(404).json({
                error: "فرآیند یافت نشد"
            });

        res.json(row);

    }
);

// ایجاد فرآیند
app.post(
    "/api/processes",
    requireAuth,
    requireRole("admin", "qc_manager"),
    (req, res) => {

        const p = req.body;

        if (!p.name)
            return res.status(400).json({
                error: "نام فرآیند الزامی است"
            });

        const id = p.id || ("pr_" + Date.now());

        db.prepare(`
            INSERT INTO processes(
                id,
                name,
                description,
                sort_order,
                active
            )
            VALUES(?,?,?,?,?)
        `).run(

            id,
            p.name,
            p.description || "",
            p.sort_order || 0,
            p.active === false ? 0 : 1

        );

        res.json({
            id
        });

    }
);

// ویرایش فرآیند
app.put(
    "/api/processes/:id",
    requireAuth,
    requireRole("admin", "qc_manager"),
    (req, res) => {

        const p = req.body;

        db.prepare(`
            UPDATE processes
            SET
                name=?,
                description=?,
                sort_order=?,
                active=?
            WHERE id=?
        `).run(

            p.name,
            p.description,
            p.sort_order,
            p.active ? 1 : 0,
            req.params.id

        );

        res.json({
            ok: true
        });

    }
);

// حذف فرآیند
app.delete(
    "/api/processes/:id",
    requireAuth,
    requireRole("admin"),
    (req, res) => {

        db.prepare(`
            DELETE FROM processes
            WHERE id=?
        `).run(req.params.id);

        res.json({
            ok: true
        });

    }
);

// ===========================================================
// PRODUCT PROCESS LINK
// ===========================================================

// فرآیندهای هر محصول
app.get(
    "/api/products/:id/processes",
    requireAuth,
    (req, res) => {

        const rows = db.prepare(`
            SELECT
                pp.id,
                pp.sort_order,
                p.*
            FROM product_processes pp
            INNER JOIN processes p
                ON p.id = pp.process_id
            WHERE pp.product_id = ?
            ORDER BY pp.sort_order
        `).all(req.params.id);

        res.json(rows);

    }
);

// اتصال فرآیند به محصول
app.post(
    "/api/products/:id/processes",
    requireAuth,
    requireRole("admin", "qc_manager"),
    (req, res) => {

        const body = req.body;

        const id = "pp_" + Date.now();

        db.prepare(`
            INSERT INTO product_processes(
                id,
                product_id,
                process_id,
                sort_order
            )
            VALUES(?,?,?,?)
        `).run(

            id,
            req.params.id,
            body.process_id,
            body.sort_order || 0

        );

        res.json({
            id
        });

    }
);

// حذف اتصال
app.delete(
    "/api/product-processes/:id",
    requireAuth,
    requireRole("admin", "qc_manager"),
    (req, res) => {

        db.prepare(`
            DELETE FROM product_processes
            WHERE id=?
        `).run(req.params.id);

        res.json({
            ok: true
        });

    }
);

// ===========================================================
// ادامه در پارت 3 ...
// ===========================================================
// ===========================================================
// CHARACTERISTIC TYPES
// ===========================================================

// لیست انواع مشخصه

app.get(
"/api/characteristic-types",
requireAuth,
(req,res)=>{

const rows=db.prepare(`
SELECT *
FROM characteristic_types
ORDER BY id
`).all();

res.json(rows);

});


// ===========================================================
// REACTION PLANS
// ===========================================================

// لیست واکنش ها

app.get(
"/api/reaction-plans",
requireAuth,
(req,res)=>{

const rows=db.prepare(`
SELECT *
FROM reaction_plans
ORDER BY title
`).all();

res.json(rows);

});


// ثبت واکنش

app.post(
"/api/reaction-plans",
requireAuth,
requireRole("admin","qc_manager"),
(req,res)=>{

const r=req.body;

if(!r.title){

return res.status(400).json({
error:"عنوان واکنش الزامی است"
});

}

const id=r.id || ("rp_"+Date.now());

db.prepare(`

INSERT INTO reaction_plans(

id,
title,
description

)

VALUES(?,?,?)

`).run(

id,
r.title,
r.description || ""

);

res.json({id});

});



// ویرایش واکنش

app.put(
"/api/reaction-plans/:id",
requireAuth,
requireRole("admin","qc_manager"),
(req,res)=>{

const r=req.body;

db.prepare(`

UPDATE reaction_plans

SET

title=?,
description=?

WHERE id=?

`).run(

r.title,
r.description,
req.params.id

);

res.json({
ok:true
});

});



// حذف واکنش

app.delete(
"/api/reaction-plans/:id",
requireAuth,
requireRole("admin"),
(req,res)=>{

db.prepare(`
DELETE FROM reaction_plans
WHERE id=?
`).run(req.params.id);

res.json({
ok:true
});

});


// ===========================================================
// OPERATORS
// ===========================================================

// لیست اپراتورها

app.get(
"/api/operators",
requireAuth,
(req,res)=>{

const rows=db.prepare(`
SELECT *
FROM operators
WHERE active=1
ORDER BY full_name
`).all();

res.json(rows);

});



// ثبت اپراتور

app.post(
"/api/operators",
requireAuth,
requireRole("admin","qc_manager"),
(req,res)=>{

const o=req.body;

if(!o.full_name){

return res.status(400).json({
error:"نام اپراتور الزامی است"
});

}

const id=o.id || ("op_"+Date.now());

db.prepare(`

INSERT INTO operators(

id,
personnel_no,
full_name,
shift,
active

)

VALUES(?,?,?,?,?)

`).run(

id,

o.personnel_no || "",

o.full_name,

o.shift || "",

1

);

res.json({
id
});

});




// ویرایش اپراتور

app.put(
"/api/operators/:id",
requireAuth,
requireRole("admin","qc_manager"),
(req,res)=>{

const o=req.body;

db.prepare(`

UPDATE operators

SET

personnel_no=?,
full_name=?,
shift=?,
active=?

WHERE id=?

`).run(

o.personnel_no,
o.full_name,
o.shift,
o.active ? 1 : 0,
req.params.id

);

res.json({
ok:true
});

});



// حذف اپراتور

app.delete(
"/api/operators/:id",
requireAuth,
requireRole("admin"),
(req,res)=>{

db.prepare(`
DELETE FROM operators
WHERE id=?
`).run(req.params.id);

res.json({
ok:true
});

});

// ===========================================================
// CONTROL PLANS
// ===========================================================

// لیست طرح های کنترل

app.get(
"/api/control-plans",
requireAuth,
(req,res)=>{

const rows=db.prepare(`

SELECT

p.id,

p.name,

p.code,

p.version,

p.traceability_code,

p.sample_interval,

p.time_tolerance,

p.plan_date,

pr.name product_name,

ps.name process_name,

u.full_name author

FROM plans p

LEFT JOIN products pr
ON pr.id=p.product_id

LEFT JOIN processes ps
ON ps.id=p.process_id

LEFT JOIN users u
ON u.id=p.created_by

WHERE p.active=1

ORDER BY p.updated_at DESC

`).all();

res.json(rows);

});



// دریافت یک طرح کنترل

app.get(
"/api/control-plans/:id",
requireAuth,
(req,res)=>{

const plan=db.prepare(`

SELECT *

FROM plans

WHERE id=?

`).get(req.params.id);

if(!plan){

return res.status(404).json({

error:"طرح کنترل پیدا نشد"

});

}

const chars=db.prepare(`

SELECT

c.*,

ct.name type_name,

rp.title reaction_name

FROM characteristics c

LEFT JOIN characteristic_types ct

ON ct.id=c.type_id

LEFT JOIN reaction_plans rp

ON rp.id=c.reaction_plan_id

WHERE c.plan_id=?

ORDER BY c.sort_order

`).all(req.params.id);

plan.characteristics=chars;

res.json(plan);

});




// ایجاد طرح کنترل

app.post(
"/api/control-plans",
requireAuth,
requireRole("admin","qc_manager"),
(req,res)=>{

const body=req.body;

if(!body.product_id){

return res.status(400).json({

error:"محصول انتخاب نشده است"

});

}

if(!body.process_id){

return res.status(400).json({

error:"فرآیند انتخاب نشده است"

});

}

const id="cp_"+Date.now();

const version="1.0";

db.withTransaction(()=>{

db.prepare(`

INSERT INTO plans(

id,

product_id,

process_id,

name,

code,

version,

traceability_code,

author,

plan_date,

sample_interval,

time_tolerance,

created_by,

active

)

VALUES(

?,?,?,?,?,?,?,?,?,?,?,?,?

)

`).run(

id,

body.product_id,

body.process_id,

body.name,

body.code,

version,

body.traceability_code,

req.user.full_name,

body.plan_date,

body.sample_interval || 60,

body.time_tolerance || 5,

req.user.id,

1

);

});
 // --------------------------------------
// Save Characteristics
// --------------------------------------

const insertCharacteristic = db.prepare(`

INSERT INTO characteristics(

id,

plan_id,

name,

type_id,

unit,

lower_limit,

target,

upper_limit,

list_values,

method,

frequency,

reaction_plan_id,

op_no,

importance,

responsible,

record_method,

required,

sort_order

)

VALUES(

?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?

)

`);

(body.characteristics || []).forEach((c,index)=>{

insertCharacteristic.run(

c.id || ("ch_"+Date.now()+"_"+index),

id,

c.name,

c.type_id || 1,

c.unit || "",

c.lower_limit ?? null,

c.target ?? null,

c.upper_limit ?? null,

JSON.stringify(c.list_values || []),

c.method || "",

c.frequency || "",

c.reaction_plan_id || null,

c.op_no || "",

c.importance || "",

c.responsible || "",

c.record_method || "",

c.required===false ? 0 : 1,

index

);

});

});

res.json({

id,

version

});

});
// ======================================================
// UPDATE CONTROL PLAN
// ======================================================

app.put(
"/api/control-plans/:id",
requireAuth,
requireRole("admin","qc_manager"),
(req,res)=>{

const body=req.body;

const current=db.prepare(
"SELECT * FROM plans WHERE id=?"
).get(req.params.id);

if(!current){

return res.status(404).json({

error:"طرح کنترل پیدا نشد"

});

}

const version=db.nextVersion(current.version);

db.withTransaction(()=>{

db.prepare(`

UPDATE plans

SET

product_id=?,

process_id=?,

name=?,

code=?,

version=?,

traceability_code=?,

plan_date=?,

sample_interval=?,

time_tolerance=?,

updated_at=datetime('now')

WHERE id=?

`).run(

body.product_id,

body.process_id,

body.name,

body.code,

version,

body.traceability_code,

body.plan_date,

body.sample_interval,

body.time_tolerance,

req.params.id

);

db.prepare(

"DELETE FROM characteristics WHERE plan_id=?"

).run(req.params.id);

const insert=db.prepare(`

INSERT INTO characteristics(

id,

plan_id,

name,

type_id,

unit,

lower_limit,

target,

upper_limit,

list_values,

method,

frequency,

reaction_plan_id,

op_no,

importance,

responsible,

record_method,

required,

sort_order

)

VALUES(

?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?

)

`);

(body.characteristics || []).forEach((c,index)=>{

insert.run(

c.id || ("ch_"+Date.now()+index),

req.params.id,

c.name,

c.type_id,

c.unit,

c.lower_limit,

c.target,

c.upper_limit,

JSON.stringify(c.list_values || []),

c.method,

c.frequency,

c.reaction_plan_id,

c.op_no,

c.importance,

c.responsible,

c.record_method,

c.required ? 1 : 0,

index

);

});

});

res.json({

ok:true,

version

});

});
// ======================================================
// DELETE CONTROL PLAN
// ======================================================

app.delete(
"/api/control-plans/:id",
requireAuth,
requireRole("admin"),
(req,res)=>{

db.prepare(`

UPDATE plans

SET active=0

WHERE id=?

`).run(req.params.id);

res.json({

ok:true

});

});
// ===========================================================
// INSPECTION FORM
// ===========================================================

// دریافت اطلاعات فرم بازرسی

app.get(
"/api/inspection/form/:planId",
requireAuth,
(req,res)=>{

const plan=db.prepare(`

SELECT

p.*,

pr.name product_name,

ps.name process_name

FROM plans p

LEFT JOIN products pr

ON pr.id=p.product_id

LEFT JOIN processes ps

ON ps.id=p.process_id

WHERE p.id=?

AND p.active=1

`).get(req.params.planId);

if(!plan){

return res.status(404).json({

error:"طرح کنترل پیدا نشد"

});

}

const operators=db.prepare(`

SELECT *

FROM operators

WHERE active=1

ORDER BY full_name

`).all();

const characteristics=db.prepare(`

SELECT

c.*,

ct.name type_name,

rp.title reaction_name

FROM characteristics c

LEFT JOIN characteristic_types ct

ON ct.id=c.type_id

LEFT JOIN reaction_plans rp

ON rp.id=c.reaction_plan_id

WHERE c.plan_id=?

ORDER BY c.sort_order

`).all(req.params.planId);

res.json({

plan,

operators,

characteristics

});

});
app.post(
"/api/inspection/header",
requireAuth,
(req,res)=>{

const h=req.body;

const id="IH_"+Date.now();

db.prepare(`

INSERT INTO inspection_headers(

id,

plan_id,

product_id,

process_id,

operator_id,

inspector_id,

inspection_date,

inspection_time,

shift,

traceability_code,

batch_no,

serial_no,

note,

status

)

VALUES(

?,?,?,?,?,?,?,?,?,?,?,?,?,?

)

`).run(

id,

h.plan_id,

h.product_id,

h.process_id,

h.operator_id,

req.user.id,

h.inspection_date,

h.inspection_time,

h.shift,

h.traceability_code,

h.batch_no,

h.serial_no,

h.note || "",

"OPEN"

);

res.json({

id

});

});
app.post(
"/api/inspection/detail",
requireAuth,
(req,res)=>{

const d=req.body;

const char=db.prepare(

"SELECT * FROM characteristics WHERE id=?"

).get(d.characteristic_id);

if(!char){

return res.status(404).json({

error:"Characteristic not found"

});

}

let status="OK";

let numeric=null;

let text=null;

switch(char.type_id){

case 1:

numeric=parseFloat(d.value);

if(char.lower_limit!=null && numeric<char.lower_limit)

status="NG";

if(char.upper_limit!=null && numeric>char.upper_limit)

status="NG";

break;

case 2:

text=d.value;

status=d.value==="PASS"

?

"OK"

:

"NG";

break;

case 3:

text=d.value;

status=d.value==="YES"

?

"OK"

:

"NG";

break;

default:

text=d.value;

}

db.prepare(`

INSERT INTO inspection_details(

id,

header_id,

characteristic_id,

numeric_value,

text_value,

status,

reaction_plan_id,

note

)

VALUES(

?,?,?,?,?,?,?,?

)

`).run(

"ID_"+Date.now()+Math.random(),

d.header_id,

d.characteristic_id,

numeric,

text,

status,

status==="NG"

?

char.reaction_plan_id

:

null,

d.note || ""

);

res.json({

status,

reaction_plan:char.reaction_plan_id

});

});
app.put(
"/api/inspection/:id/close",
requireAuth,
(req,res)=>{

db.prepare(`

UPDATE inspection_headers

SET status='CLOSED'

WHERE id=?

`).run(req.params.id);

res.json({

ok:true

});

});
