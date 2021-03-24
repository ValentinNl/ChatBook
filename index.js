const express = require("express");
var session = require("express-session");
var cookieParser = require('cookie-parser');
var ws = require("nodejs-websocket");
const app = express();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");




// Functions
function calcul_creneaux_non_existants(db,server){
	// Déclaration variable
	var db_creneaux_non_existants, db_utilisateurs_par_creneaux;
	// Récupération des créneaux n'existants pas
	const sql = "select Avoir.debut, Avoir.fin, Livre.Livre_ID, Livre.titre from Avoir , Aimer, Utilisateur, Livre where Utilisateur.login = Avoir.login \
							and Aimer.login = Utilisateur.login and Livre.Livre_ID = Aimer.Livre_ID group by Avoir.debut, Livre.titre having count(Utilisateur.login) >= 2 \
							except \
							select Reserver.debut, Reserver.fin, Livre.Livre_ID, Livre.titre from Reserver, Utilisateur, Livre where Utilisateur.login = Reserver.login \
							and Reserver.Livre_ID = Livre.Livre_ID group by Reserver.debut, Livre.Livre_ID;";
	// Récupération des disponibilités pour les utilisateurs
	const sql2 = "select Avoir.debut, Avoir.fin, Aimer.Livre_ID, Livre.titre, group_concat(Utilisateur.login) as utilisateurs from Avoir , Aimer, Utilisateur, Livre where Utilisateur.login = Avoir.login \
									and Aimer.login = Utilisateur.login  and Livre.Livre_ID = Aimer.Livre_ID  group by Avoir.debut, Livre.titre having count(Utilisateur.login) >= 2;";

	db.all(sql, [], (err, creneaux_non_existants) => {
		if (err) {
		return console.error(err.message);
		}
		console.log(creneaux_non_existants);
		db.all(sql2, [], (err, utilisateurs_par_creneaux) => {
			if (err) {
			return console.error(err.message);
			}
			console.log(utilisateurs_par_creneaux);
			creneaux_non_existants.forEach(function (creneau) {
				utilisateurs_par_creneaux.forEach(function (utilisateurs) {
					if( creneau.debut == utilisateurs.debut && creneau.fin == utilisateurs.fin && creneau.Livre_ID == utilisateurs.Livre_ID){
						// Si le creneaux n'existe pas on ajoute les utilisateurs dedans
						var liste_utilisateur = utilisateurs.utilisateurs.split(',');
						console.log(liste_utilisateur);
						liste_utilisateur.forEach(function (userReservation) {
							const query_insert = "insert into Reserver values (?, ?, ?, ?, 'WAITING')";
							var variable = [userReservation, creneau.debut, creneau.fin, creneau.Livre_ID];
							db.run(query_insert, variable, err => {
								if (err) {
								return console.error(err.message);
								}
						  });
						});
						// On insère les notifications
						db.serialize(() => {
							var data = {
								date : new Date().toISOString(),
								titre : 'Nouvelle réunion à : ' + creneau.debut ,
								contenu : "Le livre sera :"+creneau.Titre,
							}
							var query1 = db.prepare("insert into Notification (horaire, titre, contenu) values (?, ?, ?)");
						  query1.run(data.date, data.titre,data.contenu, function (err) {
						    if (err) throw err;
						    var lastID = this.lastID;
								// Notification des utilisateurs
								liste_utilisateur.forEach(function (userNotification) {
									var query2 = db.prepare("insert into Notifier values (?, ?)");
									envoieNotif(db,server,data,userNotification);
									query2.run(userNotification,lastID, function (err) {
								    if (err) throw err;
									});
							  });
							});
						});
					}
				});
			});
		});
	});
}

function calcul_creneaux_existants(db,server,user){
	// Déclaration variable
	// Récupération des créneaux n'existants pas
	const sql = "select Avoir.debut, Avoir.fin, Livre.Livre_ID, Livre.titre from Avoir , Aimer, Utilisateur, Livre where Utilisateur.login = Avoir.login \
							and Aimer.login = Utilisateur.login and Livre.Livre_ID = Aimer.Livre_ID group by Avoir.debut, Livre.titre \
							INTERSECT \
							select Reserver.debut, Reserver.fin, Livre.Livre_ID, Livre.titre from Reserver, Utilisateur, Livre, Aimer where Utilisateur.login = Reserver.login \
							and Reserver.Livre_ID = Livre.Livre_ID and (Reserver.debut || Livre.Livre_ID) not in ( \
								select (Reserver.debut || Livre.Livre_ID) from Reserver, Utilisateur, Livre where Utilisateur.login = Reserver.login \
								and Reserver.Livre_ID = Livre.Livre_ID and Utilisateur.login = \""+user+"\") \
								and Livre.Livre_ID = Aimer.Livre_ID and Aimer.login = \""+user+"\" group by Reserver.debut";

		db.all(sql, [], (err, creneaux_a_ajouter) => {
			if (err) {
				return console.error(err.message);
			}
			console.log(creneaux_a_ajouter);
			creneaux_a_ajouter.forEach(function (creneau) {
				const query_insert = "insert into Reserver values (?, ?, ?, ?, 'WAITING')";
				var variable = [user, creneau.debut, creneau.fin, creneau.Livre_ID];
				db.run(query_insert, variable, err => {
					if (err) {
						return console.error(err.message);
					}
					// On insère les notifications
					db.serialize(() => {
						var data = {
							date : new Date().toISOString(),
							titre : 'Rejoigner la réunion à : ' + creneau.debut ,
							contenu : "Le livre sera :"+creneau.Titre,
						}
						var query1 = db.prepare("insert into Notification (horaire, titre, contenu) values (?, ?, ?)");
						query1.run(data.date,data.titre,data.contenu , function (err) {
							if (err) throw err;
							envoieNotif(db,server,data,user);
							var lastID = this.lastID;
							// Notification de l'utilisateur
							var query2 = db.prepare("insert into Notifier values (?, ?)");
							query2.run(user,lastID, function (err) {
								if (err) throw err;
							});
						});
					});
				});
			});
		});
	}

	function envoieNotif(db,server,donnees,user){
		var payload = {
			type : "NOTIF",
			donnees : donnees,
		}
		var msg = JSON.stringify(payload);
		const sql = "SELECT key FROM Utilisateur WHERE login = ?";
	  db.get(sql, user, (err, row) => {
			if (err) {return console.error(err.message);}
			server.connections.forEach(function(conn) {
				if(conn.key == row.key){
					conn.sendText(msg)
				}
			})
		});
	}

	var server = ws.createServer(function(conn) {

		console.log("Nouvelle connexion");
		const db_name = path.join(__dirname, "data", "ChatBook.db");
		const db = new sqlite3.Database(db_name, err => {
		if (err) {
	 		return console.error(err.message);
		}
		    console.log("Connexion réussie à la base de données 'ChatBook.db'");
		});

		// Réception d'un message texte
		conn.on("text", function(msg) {
			console.log("Texte reçu : " + msg);
			var payload = JSON.parse(msg);
			if(payload.type == "INIT"){
				const book = [conn.key, payload.data];
				const sql = "UPDATE Utilisateur SET key = ? WHERE login = ?";
				db.run(sql, book, err => {
					if (err) {
		        return console.error(err.message);
		      }
				});
			}else{
				conn.sendText("ERR");
				conn.close();
			}
		});

		// Fermeture de connexion
    conn.on("close", function(code, reason) {
    });

    // En cas d'erreur
    conn.on("error", function(err) {
    });


	}).listen(8001); // On écoute sur le port 8001

app.use(session({secret: 'mon_secret'}));
app.use(cookieParser());

const db_name = path.join(__dirname, "data", "ChatBook.db");
const db = new sqlite3.Database(db_name, err => {
	if (err) {
    	return console.error(err.message);
	}
    console.log("Connexion réussie à la base de données 'ChatBook.db'");
});

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
  console.log("Serveur démarré (http://192.168.1.100:8080/) !");
});

app.get("/", (req, res) => {
  res.render("login");
});

app.get("/about", (req, res) => {
  res.render("about");
});


//get the login view
app.get("/login", (req, res) => {
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
  // if user is identified
  if (req.session.login) {
  const sql_liked = "SELECT * FROM Livre, Aimer WHERE Aimer.login = ? AND Livre.Livre_ID=Aimer.Livre_ID ORDER BY Livre.Titre";
  const sql_nliked = "SELECT Livre.Livre_ID, Livre.Titre, Livre.Commentaires, Livre.Auteur FROM Livre EXCEPT select Livre.Livre_ID, Livre.Titre, Livre.Commentaires, Livre.Auteur from Livre, Aimer where Livre.Livre_ID = Aimer.Livre_ID AND ? = Aimer.login ORDER BY Livre.Titre";
  db.all(sql_liked, req.session.login, (err, likes) => {
    if (err) {
      return console.error(err.message);
    }
    db.all(sql_nliked, req.session.login, (err, nlikes) => {
      if (err) {
        return console.error(err.message);
      }
      const sql_results = {nlikes: nlikes, likes:  likes};
      res.render('livres.ejs', {model: sql_results});
    });
  });
  } else { res.redirect("/login"); }
});

//add a book into Aimer table for the logged in user
app.get("/create_preference/:livre/:login", (req, res) => {
  // if user is identified
  if (req.session.login) {
    const values = [req.params.login, req.params.livre];
    const sql = "INSERT INTO Aimer (login, Livre_ID) VALUES (?, ?)";
    db.run(sql, values,(err, rows) => {
      if (err) {
        return console.error(err.message);
      }
      res.redirect("/livres");
    });
  } else { res.redirect("/login"); }
});

//delete a book from preference of logged in user
app.get("/delete_preference/:livre/:login", (req, res) => {
  // if user is identified
  if (req.session.login) {
    const values = [req.params.login, req.params.livre];
    const sql = "DELETE FROM Aimer WHERE login = ? AND Livre_ID = ?";
    db.run(sql, values,(err, rows) => {
      if (err) {
        return console.error(err.message);
      }
      res.redirect("/livres");
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
	calcul_creneaux_non_existants(db,server);
	calcul_creneaux_existants(db,server,req.session.login);
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
