const express = require("express");
var session = require("express-session");
var cookieParser = require('cookie-parser');
const app = express();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

app.use(session({secret: 'mon_secret'}));
app.use(cookieParser());

const db_name = path.join(__dirname, "data", "apptest.db");
const db = new sqlite3.Database(db_name, err => {
	if (err) {
    	return console.error(err.message);
	}
    console.log("Connexion réussie à la base de données 'apptest.db'");
});

//const sql_create = `CREATE TABLE IF NOT EXISTS Livres (
//  Livre_ID INTEGER PRIMARY KEY AUTOINCREMENT,
//    Titre VARCHAR(100) NOT NULL,
//	  Auteur VARCHAR(100) NOT NULL,
//	    Commentaires TEXT
//);`;
//
//db.run(sql_create, err => {
//  if (err) {
//      return console.error(err.message);
//  }
//  console.log("Création réussie de la table 'Livres'");
//  // Alimentation de la table
//     const sql_insert = `INSERT INTO Livres (Livre_ID, Titre, Auteur, Commentaires) VALUES
//	   (1, 'Mrs. Bridge', 'Evan S. Connell', 'Premier de la série'),
//	     (2, 'Mr. Bridge', 'Evan S. Connell', 'Second de la série'),
//		   (3, 'L''ingénue libertine', 'Colette', 'Minne + Les égarements de Minne');`;
//		     db.run(sql_insert, err => {
//			     if (err) {
//				       return console.error(err.message);
//					       }
//						       console.log("Alimentation réussie de la table 'Livres'");
//});
//});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "/public")));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false })); // <--- paramétrage du middleware
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))


// allow to pass req.session.login to all templates. Just need to call 'login' (see example in _header.ejs )
app.use(function(req, res, next) {
  res.locals.login = req.session.login;
  next();
});

app.listen(8080, () => {
  console.log("Serveur démarré (http://localhost:8080/) !");
});

app.get("/", (req, res) => {
  res.render("login");
});

app.get("/about", (req, res) => {
  res.render("about");
});


//get the login view
app.get("/login", (req, res) => {
  console.log(req.session);
	res.render("login");
});

//Post for login
app.post("/login", (req, res, next) => {
  //get the value from the form
  const login = req.body.login;

  //build sql query
  const sql = "SELECT * FROM Utilisateurs where login = ?";

  //execute sql query (sql, (? = login), return err and row
  db.get(sql, login, (err, row) => {
    //manage errors
    if (err) {
      console.log(err); 
    } else {
    //check if the query return something (user exist) 
    if (row) {
      // defining session
      req.session.login = row.login;
      res.redirect("/livres");
    } else { res.redirect("/login"); }
    }
  });
});

// logout function, is called when disconnect button is clicked
app.get("/logout", (req, res) => {
  req.session.destroy(function(err) {
    if (err) {
      console.log(err);
    }
	  res.redirect("login");
  });
});

app.get("/livres", (req, res) => {
  console.log(req.session);
  // if user is identified
  if (req.session.login) {
  const sql = "SELECT * FROM Livres ORDER BY Titre";
  db.all(sql, (err, rows) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("livres", {
      model: rows
    });
  });
  } else { res.redirect("/login"); }
});

// GET /edit/5
app.get("/edit/:id", (req, res) => {
  const id = req.params.id;
  const sql = "SELECT * FROM Livres WHERE Livre_ID = ?";
  db.get(sql, id, (err, row) => {
    // if (err) ...
    res.render("edit", { model: row });
  });
});

// POST /edit/5
app.post("/edit/:id", (req, res) => {
  const id = req.params.id;
  const book = [req.body.Titre, req.body.Auteur, req.body.Commentaires, id];
  const sql = "UPDATE Livres SET Titre = ?, Auteur = ?, Commentaires = ? WHERE (Livre_ID = ?)";
  db.run(sql, book, err => {
    // if (err) ...
    res.redirect("/livres");
  });
});

// GET /create
app.get("/create", (req, res) => {
  res.render("create", { model: {} });
});

// GET /create
app.get("/create", (req, res) => {
  const book = {
    Auteur: "Victor Hugo"
  }
  res.render("create", { model: book });
});

// POST /create
app.post("/create", (req, res) => {
  const sql = "INSERT INTO Livres (Titre, Auteur, Commentaires) VALUES (?, ?, ?)";
  const book = [req.body.Titre, req.body.Auteur, req.body.Commentaires];
  db.run(sql, book, err => {
    // if (err) ...
    res.redirect("/livres");
  });
});


// GET /delete/5
app.get("/delete/:id", (req, res) => {
  const id = req.params.id;
  const sql = "SELECT * FROM Livres WHERE Livre_ID = ?";
  db.get(sql, id, (err, row) => {
    // if (err) ...
    res.render("delete", { model: row });
  });
});

// POST /delete/5
app.post("/delete/:id", (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM Livres WHERE Livre_ID = ?";
  db.run(sql, id, err => {
    // if (err) ...
    res.redirect("/livres");
  });
});
