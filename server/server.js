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
