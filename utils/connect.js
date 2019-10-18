// Require MySQL for Node
const mysql = require('mysql');

// Export Function
module.exports = (cb) => {
    try {
        // try to establish connection w/ info from .env
        var con = mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE
        });
    }catch (err) {
        console.log(`ERROR: connect: mysql.createConnection(): ${err}`);
    }
    con.connect((err) => {
        if (err) {
            console.log(`ERROR: connect: con.connect(): ${err}`);            
        }else {
            try {
                cb(con);
            }catch (err) {
                console.log(`ERROR: connect: cb(con): ${err}`);                
            }
            setTimeout(() => {
                // Close the connection after an allotted time
                // This prevents MySQL from crashing after a certain amount of time especially when running on tmux
                try {
                    con.end();                    
                }catch (err) {
                    console.log(`ERROR: connect: con.end(): ${err}`);                    
                }
            }, 60 * 1000);
        }
    });
}

/*
 * Usage: Require Path to script
 * example: const connect = require('./connect.js');

 * Example use in file:
    connect((con) => {
        var query = 'What ever query is going to be';
        try {
            con.query(query, (err, result, fields) => {
                if (error) {
                    console.log(error);                
                }else {
                    console.log(result);
                    // results is returned as array of objects           
                }
            })
        }catch (error) {
            console.log(error);        
        }
    });
*/