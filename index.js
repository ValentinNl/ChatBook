const express = require("express");
var session = require("express-session");
var cookieParser = require('cookie-parser');
const app = express();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

app.use(session({secret: 'mon_secret'}));
app.use(cookieParser());

const db_name = path.join(__dirname, "data", "ChatBook.db");
const db = new sqlite3.Database(db_name, err => {
	if (err) {
    	return console.error(err.message);
	}
    console.log("Connexion réussie à la base de données 'ChatBook.db'");
});

//const sql_create = `CREATE TABLE IF NOT EXISTS Livre (
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
//  console.log("Création réussie de la table 'Livre'");
//  // Alimentation de la table
//     const sql_insert = `INSERT INTO Livre (Livre_ID, Titre, Auteur, Commentaires) VALUES
//	   (1, 'Mrs. Bridge', 'Evan S. Connell', 'Premier de la série'),
//	     (2, 'Mr. Bridge', 'Evan S. Connell', 'Second de la série'),
//		   (3, 'L''ingénue libertine', 'Colette', 'Minne + Les égarements de Minne');`;
//		     db.run(sql_insert, err => {
//			     if (err) {
//				       return console.error(err.message);
//					       }
//						       console.log("Alimentation réussie de la table 'Livre'");
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
  const sql = "SELECT * FROM Utilisateur where login = ?";

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
  const sql = "SELECT * FROM Livre ORDER BY Titre";
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
  const sql = "SELECT * FROM Livre WHERE Livre_ID = ?";
  db.get(sql, id, (err, row) => {
    // if (err) ...
    res.render("edit", { model: row });
  });
});

// POST /edit/5
app.post("/edit/:id", (req, res) => {
  const id = req.params.id;
  const book = [req.body.Titre, req.body.Auteur, req.body.Commentaires, id];
  const sql = "UPDATE Livre SET Titre = ?, Auteur = ?, Commentaires = ? WHERE (Livre_ID = ?)";
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
  const sql = "INSERT INTO Livre (Titre, Auteur, Commentaires) VALUES (?, ?, ?)";
  const book = [req.body.Titre, req.body.Auteur, req.body.Commentaires];
  db.run(sql, book, err => {
    // if (err) ...
    res.redirect("/livres");
  });
});


// GET /delete/5
app.get("/delete/:id", (req, res) => {
  const id = req.params.id;
  const sql = "SELECT * FROM Livre WHERE Livre_ID = ?";
  db.get(sql, id, (err, row) => {
    // if (err) ...
    res.render("delete", { model: row });
  });
});

// POST /delete/5
app.post("/delete/:id", (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM Livre WHERE Livre_ID = ?";
  db.run(sql, id, err => {
    // if (err) ...
    res.redirect("/livres");
  });
});


// Partie sur les notifications
app.get("/notifications", (req, res) => {
  const sql = "select Notification.horaire, Notification.titre, Notification.contenu from Utilisateur , Notification, Notifier where Utilisateur.login = Notifier.login and Notifier.id = Notification.id and Utilisateur.login = \"" + req.session.login + "\" ORDER BY Notification.horaire DESC LIMIT 10;";
    db.all(sql, [], (err, rows) => {
	    if (err) {
			return console.error(err.message);
	    }
      res.render("notifications", { model: rows });
   });
});

//Disponibilite GET
app.get("/disponibilite", (req, res) => {
  	const sql = "SELECT * FROM Avoir WHERE login = ? ORDER BY debut";
		var variable = [req.session.login];
    db.all(sql, variable, (err, rows) => {
	    if (err) {
			return console.error(err.message);
	    }
			var h,m,s,d,j;
			var dispos =[];
			var tab_jour=new Array("Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi");
			var tab_mois=new Array("01", "02", "03", "04", "05", "06", "07","08","09","10","11","12");
			rows.forEach(function (row) {
				var dispo = {
					date : "erreur",
					heureDebut : "erreur",
					heureFin : "erreur",
					debut : "erreur",
					fin : "erreur",
					login: "erreur",
					timestamp : "erreur",
				}
				d = new Date(Date.parse(row.debut));
				dispo.timestamp = d.getTime();
				if(d.getDate()<10){
				    j = '0'+d.getDate();
				}
				else{
				    j = d.getDate();
				}
				dispo.date = tab_jour[d.getDay()]+' '+j+'/'+tab_mois[d.getMonth()]+'/'+d.getFullYear();
				if(d.getHours()<10){
				    h = '0'+d.getHours();
				}
				else{
				    h = d.getHours();
				}

				if(d.getMinutes()<10){
				    m = '0'+d.getMinutes();
				}
				else{
				    m = d.getMinutes();
				}
				dispo.heureDebut = h+':'+m;
				d = new Date(Date.parse(row.fin));
				if(d.getHours()<10){
				    h = '0'+d.getHours();
				}
				else{
				    h = d.getHours();
				}

				if(d.getMinutes()<10){
				    m = '0'+d.getMinutes();
				}
				else{
				    m = d.getMinutes();
				}
				dispo.heureFin = h+':'+m;
				dispo.debut = row.debut;
				dispo.fin = row.fin;
				dispo.login = row.login;
				dispos.push(dispo);
			});
			res.render("disponibilite", { dispos });
   });
});

// GET /create /disponibilite
app.get("/create_dispo", (req, res) => {
  var dispo = {
    now : "",
		date :"",
		radioAM :"",
		radioPM :"",
  }
	const d = new Date().toISOString();
	temp=d.split('T');
	dispo.now = temp[0];
  res.render("create_dispo", { dispo });
});

// POST /create /disponibilite
app.post("/create_dispo", (req, res) => {
  var dateDebut = req.body.date;
	var dateFin = req.body.date;
	if(req.body.heure == "AM"){
		dateDebut = dateDebut+" 08:00:00";
		dateFin = dateFin+" 12:00:00";
	}else {
		dateDebut = dateDebut+" 14:00:00";
		dateFin = dateFin+" 18:00:00";
	}
	var sql ="select count(*) as nb from Disponibilite where debut = ? AND fin = ?";
  var variable = [dateDebut, dateFin];
	db.get(sql, variable, (err, num) => {
		if (err) {
		return console.error(err.message);
		}
		if(num.nb == 0){
			sql = "insert into Disponibilite (debut,fin) values (?,?)";
		  variable = [dateDebut, dateFin];
			db.run(sql, variable, err => {
				if (err) {
				return console.error(err.message);
				}
			});
		}
		sql = "insert into Avoir (login,debut,fin) values (?,?,?)";
		variable = [req.session.login,dateDebut, dateFin];
		db.run(sql, variable, err => {
			if (err) {
			return console.error(err.message);
			}
		});
    res.redirect("/disponibilite");
  });
});

// GET /delete /disponibilite
app.get("/delete_dispo/:id", (req, res) => {
	var id = req.params.id;
	dateCreneau =new Date(parseInt(id));
	var d = dateCreneau.toISOString();
	temp=d.split('T');
  var dispo = {
		date : temp[0],
		radioAM :"",
		radioPM :"",
  }
	console.log(dateCreneau.getHours());
	if(dateCreneau.getHours() == 8){
		dispo.radioAM = "checked";
	}else {
		dispo.radioPM = "checked";
	}
  res.render("delete_dispo", { dispo });
});

// POST /delete /disponibilite
app.post("/delete_dispo", (req, res) => {
	var dateDebut = req.body.date;
	var dateFin = req.body.date;
	if(req.body.heure == "AM"){
		dateDebut = dateDebut+" 08:00:00";
		dateFin = dateFin+" 12:00:00";
	}else {
		dateDebut = dateDebut+" 14:00:00";
		dateFin = dateFin+" 18:00:00";
	}
	var sql = "DELETE from Avoir where login  = ? AND debut = ? AND fin = ?  ";
	var variable = [req.session.login,dateDebut, dateFin];
	db.all(sql, variable, (err, num) => {
		if (err) {
		return console.error(err.message);
		}
		res.redirect("/disponibilite");
  });
});
