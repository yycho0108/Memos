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
//var env = fs.readFileSync('.env', {encoding: 'UTF8', flag: 'r'});
//var vars = env.split('\n');
//for (i in vars) {
//    if (vars[i]) {
//        var entry = vars[i].split('=');
//        var field = entry[0];
//        var value = entry[1];
//        if (field && value) {
//            process.env[field] = value;
//        }
//    }
//}

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
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: "us-east-1",
    endpoint: process.env.ENDPOINT 
});

var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

function exists(tablename, cb) {
    dynamodb.describeTable({TableName: tablename}, function (err, data) {
        if (err) {
            console.log(err);
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
                {AttributeName: "created", KeyType: "HASH"},  //Partition key
                {AttributeName: "title", KeyType: "RANGE"}  //Sort key
            ],
            AttributeDefinitions: [
                {AttributeName: "created", AttributeType: "N"},
                {AttributeName: "title", AttributeType: "S"}
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
        TableName: 'Memos',
        Limit: 15  // Limits the number of results per page
    };

    var memos = [];
    docClient.scan(params).eachPage(function(err,data) {
        if(err){
            console.log(err);
            res.end(JSON.stringify(err));
        }else if (data){
            for (var i = 0; i < data.Items.length; i++ ) {
                memos.push(data.Items[i]);
            }
        }else{
            console.log(JSON.stringify(memos));
            res.render('index');
        }
    });

});

app.post('/', function (req, res) {
    var form = new formidable.IncomingForm();

    form.parse(req, function (err, fields, files) {
        console.log("PARSING QUERY FORM");
        console.log(fields);

        var filter = '';
        var filterValues = {};

        if(fields.title){
            filter += 'contains(title, :t)';
            filterValues[':t'] = fields.title;
        }

        for (i in fields){
            if(fields.hasOwnProperty(i) && fields[i] == 'tag'){//checkbox
                var placeholder = ':tag' + Object.keys(filterValues).length;
                filter += ' AND contains(tags,' + placeholder + ')';
                filterValues[placeholder] = i;
            }
        }

        var params = {
            TableName: 'Memos',
            Limit: 15,  // Limits the number of results per page
            FilterExpression: filter,
            ExpressionAttributeValues: filterValues
        };

        var memos = [];
        docClient.scan(params).eachPage(function(err,data) {
            if(err){
                console.log(err);
                res.end(JSON.stringify(err));
            }else if (data){
                for (var i = 0; i < data.Items.length; i++ ) {
                    memos.push(data.Items[i]);
                }
            }else{
                res.end(JSON.stringify(memos));
                //res.render('index');
            }
        });
    });
});

app.get('/upload', function (req, res) {
    res.render('upload');
});

app.post('/upload', function (req, res) {
    var form = new formidable.IncomingForm();

    form.parse(req, function (err, fields, files) {
        console.log("PARSING UPLOAD FORM");
        console.log(fields);

        var item = {
            title : fields.title.toLowerCase(),
            created : Date.now(),
            tags : []
        };

        for (i in fields){
            if(fields.hasOwnProperty(i) && fields[i] == 'tag'){//checkbox
                item.tags.push(i.toLowerCase()); //add tag field name in lowercase
            }
        }

        console.log(JSON.stringify(fields));

        put(item, function (err, data) {
            console.log("WRITING TO MEMO");
            console.log(err);
            console.log(data);
            res.redirect('/');
        });
    });
});

/* DELETE
dynamodb.deleteTable(params, function(err, data) {
    if (err) {
        console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
    }
});
*/

var port = process.env.PORT || 9900;
console.log("app listening on PORT", port);
app.listen(port);
