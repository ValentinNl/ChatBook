const express = require("express");

const app = express();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

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

app.listen(8080, () => {
  console.log("Serveur démarré (http://localhost:8080/) !");
});

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/data", (req, res) => {
	const test = {
    	titre: "Test",
	    items: ["un", "deux", "trois"]
	};
	res.render("data", { model: test });
});

app.get("/livres", (req, res) => {
  const sql = "SELECT * FROM Livres ORDER BY Titre";
    db.all(sql, [], (err, rows) => {
	    if (err) {
			return console.error(err.message);
	    }
      res.render("livres", { model: rows });
   });
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

//Disponibilite GET
app.get("/disponibilite", (req, res) => {
  	const sql = "SELECT * FROM Avoir WHERE login = \"toto\" ORDER BY debut";
    db.all(sql, [], (err, rows) => {
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
				dispo.timestamp = d.getTime();
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
	var sql ="select count(*) from Disponibilite where debut = ? AND fin = ?";
  var variable = [dateDebut, dateFin];
	db.all(sql, variable, (err, num) => {
		if (err) {
		return console.error(err.message);
		}
		if(num == 0){
			sql = "insert into Disponibilite (debut,fin) values (?,?)";
		  variable = [dateDebut, dateFin];
			db.run(sql, variable, err => {
				if (err) {
				return console.error(err.message);
				}
			});
		}
		sql = "insert into Avoir (login,debut,fin) values (\"toto\",?,?)";
		variable = [dateDebut, dateFin];
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
	var d = new Date(parseInt(id)).toISOString();
	temp=d.split('T');
  var dispo = {
		date : temp[0],
		radioAM :"",
		radioPM :"",
  }
	if(temp[1] == "08:00"){
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
	var sql = "DELETE from Avoir where login  = \"toto\" AND debut = ? AND fin = ?  ";
	var variable = [dateDebut, dateFin];
	db.all(sql, variable, (err, num) => {
		if (err) {
		return console.error(err.message);
		}
		res.redirect("/disponibilite");
  });
});
