require("dotenv").config();
const express = require("express");
const bodyparser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', "ejs");
app.use(bodyparser.urlencoded({extended: true}));

app.use(session({
  secret: "This is my secret.",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate("google", {scope: ["profile"]})
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect("/secrets");
  });

app.get("/submit", (req, res)=>{
  if (req.isAuthenticated()) {
    res.render("submit");
  }
  else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/logout", (req, res)=>{
  req.logout();
  res.redirect("/");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/secrets", (req, res)=>{
 User.find({secret: {$ne:null}}, (err, foundUser)=>{
   if (err) {
     console.log(err);
   } else {
     if (foundUser) {
       res.render("secrets", {usersWithSecrets: foundUser})
     }
   }
 });
});

app.post("/register", (req, res) => {

  User.register({username:req.body.username}, req.body.password, (err, user)=>{
    if (err) {
      console.log(err);
      res.redirect("/login")
    } else {
      passport.authenticate("local")(req, res, ()=>{
        res.redirect("/secrets");
      });
    }
  });

});

app.post("/login", (req, res) => {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, (err)=>{
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, ()=>{
        res.redirect("/secrets");
      });
    }
  });

});

app.post("/submit", (req,res)=>{
  const submittedSecret = req.body.secret;

  User.findById(req.user.id, (err, foundUser)=>{
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(()=>{
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
