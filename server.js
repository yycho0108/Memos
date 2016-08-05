/**
 * Created by jamiecho on 8/4/16.
 */

var fs = require('fs');
var formidable = require('formidable');
var bodyparser = require('body-parser');
var cookieParser = require('cookie-parser');
var path = require('path');
var session = require('express-session');

/* FOR NOW, LOAD ENVIRONMENT VARIABLES LIKE THIS*/
var env = fs.readFileSync('.env', {encoding: 'UTF8', flag: 'r'});
var vars = env.split('\n');
for (i in vars) {
    if (vars[i]) {
        var entry = vars[i].split('=');
        var field = entry[0];
        var value = entry[1];
        if (field && value) {
            process.env[field] = value;
        }
    }
}

var tmp_dir = path.join(__dirname, 'tmp');
var public_dir = path.join(__dirname, 'public');

if (!fs.existsSync(tmp_dir))
    fs.mkdirSync(tmp_dir);

if (!fs.existsSync(public_dir))
    fs.mkdirSync(public_dir);


var express = require('express');
var app = express();

//boilerplate initialization
app.use(bodyparser.json());
app.use(cookieParser());

app.use(express.static(tmp_dir)); //statically served files
app.use(express.static(public_dir));

//this will be the location of the files

app.use(session({
    secret: 'TunaDr3ams',
    resave: false,
    saveUninitialized: true,
}));

app.set('view engine', 'jade');

var AWS = require("aws-sdk");
AWS.config.update({
    accessKeyId: "NONE",//process.env.AWS_ACCESS_KEY,
    secretAccessKey: "NONE",//process.env.AWS_SECRET_ACCESS_KEY,
    region: "us-east",
    endpoint: "http://localhost:8000"
});

var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();


// CREATE TABLE

/*var params = {
 TableName : "Movies",
 KeySchema: [
 { AttributeName: "year", KeyType: "HASH"},  //Partition key
 { AttributeName: "title", KeyType: "RANGE" }  //Sort key
 ],
 AttributeDefinitions: [
 { AttributeName: "year", AttributeType: "N" },
 { AttributeName: "title", AttributeType: "S" }
 ],
 ProvisionedThroughput: {
 ReadCapacityUnits: 10,
 WriteCapacityUnits: 10
 }
 };

 dynamodb.createTable(params, function(err, data) {
 if (err) {
 console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
 } else {
 console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
 }
 });
 */


function exists(tablename, cb) {
    dynamodb.describeTable({TableName: tablename}, function (err, data) {
        if (err) {
            cb(err.statusCode != 400);
        } else {
            //console.log(data);
            cb(true);
        }
    });
}

function put(data, cb) {
    var params = {
        TableName: "Memos",
        Item: data
    };
    docClient.put(params, cb);
}

exists('Memos', function (ex) {
    if (!ex) {
        //create table if it doesn't exist
        var params = {
            TableName: "Memos",
            KeySchema: [
                {AttributeName: "title", KeyType: "HASH"},  //Partition key
                {AttributeName: "created", KeyType: "RANGE"}  //Sort key
            ],
            AttributeDefinitions: [
                {AttributeName: "title", AttributeType: "S"},
                {AttributeName: "created", AttributeType: "S"}
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 10,
                WriteCapacityUnits: 10
            }
        };

        dynamodb.createTable(params, function (err, data) {
            if (err) {
                console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
            }
        });
    }
});

app.get('/', function (req, res) {
    var params = {
        TableName: "Memos",
        //ProjectionExpression: "#yr, title, info.rating",
        //FilterExpression: "#yr between :start_yr and :end_yr",
        //ExpressionAttributeNames: {
        //    "#yr": "year",
        //},
        //ExpressionAttributeValues: {
        //    ":start_yr": 1950,
        //    ":end_yr": 1959
        //}
    };

    docClient.scan(params, function (err, data) {
        console.log("SCAN COMPLETE");
        console.log(err);
        res.end(JSON.stringify(data));
    });
});


app.post('/', function (req, res) {

    var form = new formidable.IncomingForm();

    form.parse(req, function (err, fileds, files) {
        /*put({
         title : "New Memo",
         created : new Date().toISOString()
         }, function (err, data) {
         console.log("WRITING TO MEMO");
         console.log(err);
         console.log(data);
         });*/
    });

});
app.get('/upload', function (req, res) {
    res.render('upload');
});

app.post('/upload', function (req, res) {
    var form = new formidable.IncomingForm();

    form.parse(req, function (err, fields, files) {

        delete fields['SUBMIT'];
        fields.created = new Date().toISOString();

        console.log(fields);

        put(fields, function (err, data) {
            console.log("WRITING TO MEMO");
            console.log(err);
            console.log(data);
            res.redirect('/');
        });
    });
});


var port = process.env.PORT || 9900;
console.log("app listening on PORT", port);
app.listen(port);