// Allow use of .env file
require('dotenv').config()

// Bring in Node Module Dependencies
const express = require('express');
const cron = require('node-cron'); // runs every so often
const schedule = require('node-schedule'); // can pass a specific date and run
const moment = require('moment');
const mailgun = require('mailgun-js')({apiKey: process.env.MAILGUN_SECRET, domain: process.env.MAILGUN_DOMAIN});

// Server Variable
const app = express();

// Database Connection script
const connect = require('./utils/connect');


// Sets PORT Value, or Defaults
app.set('port', process.env.PORT || 3000);


// Cron to get the emails every so often.
/*
 * Cron Schedule Times: 
    Seconds(optional) | Minutes | Hour | Day of Month | Month | Day of Week
    
*/
// Every 15th minute: */15 * * * *

// queue holder array
const queue = [];
const emails = function collectEmailsForMailGun(obj) {
    queue.push(obj);
    queueJobs(queue)    
};





// Get current datetime stamp and convert to MySQL time
// cron.schedule('* * * * *', () => {
    connect((con) => {
        var now = moment().format('YYYY-MM-DD H:mm:s');
        var query = `SELECT events.id, events.course_instance_id, events.start_time, events.end_time, events.email_status, course_instances.id as course_instance_id, courses.id as course_id, course_emails.id as course_email_id, course_emails.subject, course_emails.body, course_emails.to_roles, course_emails.to_other, course_emails.cc_roles, course_emails.cc_other, course_emails.time_amount, course_emails.time_type, course_emails.time_offset from events left join course_instances on events.course_instance_id = course_instances.id left join course_emails on course_instances.course_id = course_emails.course_id left join courses on course_emails.course_id = courses.id where events.deleted_at is null and course_instances.deleted_at is null and course_emails.retire_date is null and courses.retire_date is null and events.email_status is null and events.start_time >= ?`;
        var values = [now];
        try {
            con.query(query, values, (error, result, fields) => {
                if (error) {
                    console.log(error);                
                }else {
                    result.forEach((item) => { // item is an object
                        emails(item)
                        // update status to pending
                        // try {
                        //     var q = `update events set email_status = 'pending' where events.id = ?`;
                        //     var val = [item.id]
                        //     con.query(q, val, (err, res) => {
                        //         if (err) throw err;
                        //     });                            
                        // }catch (err) {
                        //     console.log(`ERROR: Could not update status to pending. ${err}`);                                                        
                        // }                                               
                    });                     
                }
            });
        }catch (error) {
            console.log(error);        
        }
    });
// });


function queueJobs(arr) {
    for (let i = 0; i < arr.length; i++) {

        // depending on offset storing empty date var, This determines what event time to grab
        var offset_expr = arr[i].time_offset
        var date;
        var amount;
        switch(offset_expr) {
            case 1:
                date = moment(arr[i].start_time).format('YYYY-MM-DD H:mm:s');
                amount = -Math.abs(arr[i].time_amount);
                break;                
            case 2:
                date = moment(arr[i].start_time).format('YYYY-MM-DD H:mm:s');
                amount = Math.abs(arr[i].time_amount);
                break;
            case 3:
                date = moment(arr[i].end_time).format('YYYY-MM-DD H:mm:s');
                amount = -Math.abs(arr[i].time_amount)
                break;
            case 4:
                date = moment(arr[i].end_time).format('YYYY-MM-DD H:mm:s');
                amount = Math.abs(arr[i].time_amount);
                break;
        }

        var type_expr = arr[i].time_type;        
        var time_type;
        switch (type_expr) {
            case 1:
                time_type = 'minutes';
                break;
            case 2:
                time_type = 'days';
                break;
            case 3:
                time_type = 'hours';
                break;
        }

        // Alter time
        var sendingDate = moment(date, 'YYYY-MM-DD H:mm:ss').add(amount, time_type).format('YYYY-MM-DD H:mm:ss');

        // Construct date for scheduler takes the following -> new Date(year, month(0-11), date, hour(24), minute, seconds)
        var year = moment(sendingDate).format('YYYY');
        var month = Number(moment(sendingDate).format('MM') -1);
        var day = moment(sendingDate).format('DD');
        var hour = moment(sendingDate).format('H');
        var min = moment(sendingDate).format('mm');
        var sec = moment(sendingDate).format('s');
        
        var queueDate = new Date(year, month, day, hour, min, sec); // this time is in YYYY-MM-DD T HH:MM:SS T format

        sendEmail(arr[i]);
        
        // Add the email to scheduler then we can do whatever when this loops iteration scheduled time is ready.
        // var job = schedule.scheduleJob(queueDate, () => {
            // sendEmail(arr[i]);
            // should remove this email obj from the main array after sent email
        // });                      
    }    
}

// Creates the email and waits until the scheduleJob call it
function sendEmail (email) {
    // console.log(email);
    
    // get email and find all the users it supposed to go to
    var to_roles = email.to_roles ? email.to_roles.split(",") : '';
    var cc_roles = email.cc_roles ? email.cc_roles.split(",") : '';
    // console.log(to_roles);
   
    connect((con) => {
        var query  = `SELECT DISTINCT course_emails.subject as subject, course_emails.body as body, sites.name as site_name, sites.abbrv as site_abbrv, users.first_name as first_name, users.last_name as last_name, users.email as email, courses.name as course_name, courses.abbrv as course_abbrv, locations.name as location_name, locations.abbrv as location_abbrv, buildings.name as building_name, buildings.abbrv as building_abbrv, buildings.map_url as map_url, events.start_time as start, events.end_time as end, resources.abbrv as resource_abbrv, resources.description as resource_desc, events.internal_comments as comment, events.fac_report as fac_start, events.fac_leave as fac_end from course_emails join course_instances on course_instances.course_id = course_emails.course_id join courses on courses.id = course_instances.course_id join sites on sites.id = courses.site_id join events on events.course_instance_id = course_instances.id join resources on resources.id = events.initial_meeting_room join locations on locations.id = resources.location_id join buildings on buildings.id = locations.building_id join role_user on role_user.role_id in ( ${to_roles.join(',')} ) join users on users.id = role_user.user_id where course_instances.id = ?`;
        var val = [email.course_instance_id];
        try {
            con.query(query, val, (error, result, fields) => {
                if (error) {
                    console.log(error);                
                }else {
                    for (let i = 0; i < result.length; i++) {

                        // Remove TinyMCE vars from Subject
                        var subject = result[i].subject;
                        var subjectMapObj = {
                            '{{site_name_full}}': result[i].site_name,
                            '{{site_name_abbrv}}' : result[i].site_abbrv,
                            '{{course_name}}' : result[i].course_name,
                            '{{course_abbrv}}' : result[i].course_abbrv,
                            '{{first_name}}' : result[i].first_name,
                            '{{last_name}}' : result[i].last_name,
                            // '{{event_month_full}}' : moment(result[i].start).local().format('MMMM'),
                            // '{{event_month_abbrv}}'  : moment(result[i].start).local().format('MMM'),
                            // '{{event_day_num}}'  : moment(result[i].start).local().format('d'),
                            // '{{event_day_full}}'  : moment(result[i].start).local().format('dddd'),
                            // '{{event_day_abbrv}}' :moment(result[i].start).local().format('ddd'),
                            '{{event_start_time}}' : moment(result[i].start).local().format('YYYY-MM-DD H:mm'),
                            '{{event_end_time}}' : moment(result[i].end).local().format('YYYY-MM-DD H:mm'),
                            '{{init_mtg_room_full}}' : result[i].resource_desc,
                            '{{init_mtg_room_abbrv}}' : result[i].resource_abbrv,
                            '{{event_comments}}' : result[i].comment,
                            // '{{event_internal_comments}}' : result[i]. ,
                            '{{faculty_start_time}}' : result[i].fac_start,
                            '{{faculty_leave_time}}' : result[i].fac_end,
                            '{{location_name_full}}' : result[i].location_name,
                            '{{location_name_abbrv}}' : result[i].location_abbrv,
                            '{{building_name_full}}' : result[i].building_name,
                            '{{building_name_abbrv}}' : result[i].building_abbrv,
                            '{{building_map_url}}' : result[i].map_url,
                            '<p>' : '',
                            '</p>' : '',
                        };

                        var re = new RegExp(Object.keys(subjectMapObj).join("|"),"gi");
                        subject = subject.replace(re, (matched) => {
                            return subjectMapObj[matched];
                        });

                        
                        // // Remove TinyMCE vars from Body
                        var body = result[i].body;
                        var bodyMapObj = {
                            '{{site_name_full}}': result[i].site_name,
                            '{{site_name_abbrv}}' : result[i].site_abbrv,
                            '{{course_name}}' : result[i].course_name,
                            '{{course_abbrv}}' : result[i].course_abbrv,
                            '{{first_name}}' : result[i].first_name,
                            '{{last_name}}' : result[i].last_name,
                            // '{{event_month_full}}' : moment(result[i].start).local().format('MMMM'),
                            // '{{event_month_abbrv}}'  : moment(result[i].start).local().format('MMM'),
                            // '{{event_day_num}}'  : moment(result[i].start).local().format('d'),
                            // '{{event_day_full}}'  : moment(result[i].start).local().format('dddd'),
                            // '{{event_day_abbrv}}' :moment(result[i].start).local().format('ddd'),
                            '{{event_start_time}}' : moment(result[i].start).local().format('YYYY-MM-DD H:mm'),
                            '{{event_end_time}}' : moment(result[i].end).local().format('YYYY-MM-DD H:mm'),
                            '{{init_mtg_room_full}}' : result[i].resource_desc,
                            '{{init_mtg_room_abbrv}}' : result[i].resource_abbrv,
                            '{{event_comments}}' : result[i].comment,
                            // '{{event_internal_comments}}' : result[i]. ,
                            '{{faculty_start_time}}' : result[i].fac_start,
                            '{{faculty_leave_time}}' : result[i].fac_end,
                            '{{location_name_full}}' : result[i].location_name,
                            '{{location_name_abbrv}}' : result[i].location_abbrv,
                            '{{building_name_full}}' : result[i].building_name,
                            '{{building_name_abbrv}}' : result[i].building_abbrv,
                            '{{building_map_url}}' : result[i].map_url,              
                        };
                        var re = new RegExp(Object.keys(bodyMapObj).join("|"),"gi");
                        body = body.replace(re, (matched) => {
                            return bodyMapObj[matched];
                        });
                        

                        // Holder for email data
                        var data = {
                            from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
                            to: result[i].email,
                            subject: subject,
                            html: body 
                        };
                        console.log(data);
                        
                        
                        // remove arr from queue after we handle it
                        // var index = queue.indexOf(email);
                        // if (index != -1) {
                        //     queue.splice(index, 1);
                        //  } 
                        // console.log(queue);
                        
                        
                        
                        
                        // Send email via Mailgun
                        // mailgun.messages().send(data, (error, response) => {
                        //     // Then we store the returned promise from Mailgun
                        //     try {
                        //         // Need to use prepared statements when inserting into DB via Node.js for security reasons. 
                        //         let timestamp = moment().utc().format('YYYY-MM-DD H:mm:ss');
                        //         var insert = `insert into sent_emails (course_email_id, mailgun_id, mailgun_message, created_at, updated_at) values (?, ?, ?, ?, ?)`;
                        //         var values = [Number(result[i].course_email_id), response.id, response.message, timestamp, timestamp];
                        //         con.query(insert, values, (err, res, fields) => {
                        //             if (err) throw err;
                        //         });                                
                        //     }catch (error) {
                        //         console.log(`ERROR: Erroring inserting into sent_emails ${error}`);                                   
                        //     }                        
                        // });
                    }

                    // Some way to update event.email_status to: sent.
                }
            })
        }catch (error) {
            console.log(error);        
        }
    });
    return // idk maybe something
}


// RUN SERVER
app.listen(app.get('port'), () => {
    console.log(`Server listening on ${app.get("port")} press Ctrl-C to terminate`);
});