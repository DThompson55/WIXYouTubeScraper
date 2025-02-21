const {mySecret, headers } = require('uuseCommons');
const {authorize,google} = require('uuseCommons');
const {formatDateToYYYYMMDD, argv, getOrdinalSuffix} = require('uuseCommons');

const axios = require('axios')
const parse = require('node-html-parser').parse;

if (argv.help){
  console.log(argv);
  return;
}

console.log(argv)

const doNotUpdate = !(argv.update);

var emailSentDate;
var emailSentDate_mm_dd;



authorize().then(getEMail).catch(console.error);


/**
*
* We're going to look for any gmail messages that came in since yesterday
* that came from UUSE, and that have the word ICYMI in the subject line 
* 
*  */
async function getEMail(auth) {

  var today = new Date()
  today.getDate();
  today.setHours(0,0,0,0);
  today.setDate(today.getDate() -1);

  console.log("Dates",new Date(), new Date((new Date()).setHours(0,0,0,0)), today);

  after = argv.date;

  console.log("looking for emails after date", after);

  const startOfDay = Math.floor(new Date(after).setHours(0, 0, 0, 0) / 1000);
  const endOfDay = startOfDay + 86400; // Add 24 hours for next day

  
  const gmail = google.gmail({version: 'v1', auth});
  gmail.users.messages.list({
    userId: 'me',
    //uuseoffice-uuse.org@shared1.ccsend.com
    //q:"after:"+after+" from:uuseoffice@uuse.org"// subject:weekly" have to be careful with the subject line
    //q:"after:"+after+" before:"+"01/27/2024"+" from:eblast@uuse.ccsend.com"// subject:weekly" have to be careful with the subject line
    q: `after:${startOfDay} before:${endOfDay} subject:ICYMI` //have to be careful with the subject line

  })
  .then((response) => {	

    if (response.data.resultSizeEstimate > 0) { // was there an email?

      console.log(JSON.stringify(response.data,null,2))

      response.data.messages.forEach((message) => {

        gmail.users.messages.get({
    	    userId: 'me',
    	    id:message.id // just get the first one?
    	  })
    	  .then((response) =>{
          //
          // Then we're going to get the second payload part which contains HTML and pass it to our parser.
          //
          const dateObj = response.data.payload.headers.find(obj => obj.name === "Date");
          const dateString = dateObj.value
          const dateComponents = dateString.split(" ");
          const dayOfWeek = dateComponents[0];
          const day = parseInt(dateComponents[1]);
          const monthStr = dateComponents[2];
          const year = parseInt(dateComponents[3]);
          const time = dateComponents[4];

          // Convert the month abbreviation to a numeric value
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const month = months.indexOf(monthStr);

          // Extract the timezone offset
          const timeZoneOffset = dateComponents[5];

          // Create a new date string in a format that Date.parse() can understand
          const formattedDateString = `${months[month]} ${day}, ${year} ${time} ${timeZoneOffset}`;

          // Parse the formatted date string
          emailSentDate = new Date(formattedDateString);

          // Create the formatted date string in "dd-mm" format
          emailSentDate_mm_dd = `${((month+1).toString().padStart(2, '0'))}-${(day.toString().padStart(2, '0'))}`;

          console.log("eMail Date    ",emailSentDate,"and as dd-mm",emailSentDate_mm_dd);
          
          const subjectLine = response.data.payload.headers.find(obj => obj.name === "Subject");
          console.log("Subject       ",subjectLine.value);

          if (subjectLine && subjectLine.value.includes("ICYMI")) {
       	  	var html = Buffer.from(response.data.payload.parts[1].body.data, 'base64').toString('UTF-8');
            
    // Regular expression to match strings starting with 'http'
    const regex = /(http\S*)/g;
    
    // Use match method to find all occurrences
    const matches = html.match(regex);
    console.log(html)
    // Return array of matched strings or empty array if no matches found
    let youtubeUrl = matches[0].slice(0, -1);

if (argv.capture){
console.log("Write the HTML to a file");
fs.writeFile('original.html', html, (err) => {
  if (err) {
    console.error('Error writing to file:', err);
  } else {
    console.log('File written successfully');
  }
});
}

    updateServiceRecord(youtubeUrl, formattedDateString)

          } 
  	  })
    })
    } else {
      console.log("There was no ICYMI found in gmail for this date",after);
    }
	})
}

//
//
//

function updateServiceRecord(youtubeUrl, formattedDateString){

  console.log("Looking for Sunday Service on",getPreviousSundayDate(new Date()),)

const options = {
  url: '/items/query',
  method: 'post', 
  baseURL: 'https://www.wixapis.com/wix-data/v2',
  headers: headers,
  data: {
    dataCollectionId: "Happenings",
    query: {
        filter: {
          "date": getPreviousSundayDate(new Date()),
          isService: {$eq: true}
        },
        paging: {
            limit: 2
        }
    }
  },
  timeout: 5000, 
  responseType: 'json', 
  responseEncoding: 'utf8', 
}

axios(options)
  .then(function (response) {

console.log(response.data.dataItems[0].data.date);
  if (response.data.dataItems.length == 1) 
    console.log((doNotUpdate?"x":" "),"Event Update  ",response.data.dataItems[0].data.date,formattedDateString);

   response.data.dataItems.forEach((item)=>{
    item.data.youTube = youtubeUrl+"&t=10";

    const options = {
      url: '/items/'+item.id,
      method: 'put', 
      baseURL: 'https://www.wixapis.com/wix-data/v2',
      headers: headers,
      data: {
        dataCollectionId: "Happenings",
        dataItem:item,
      },
      timeout: 5000, 
      responseType: 'json', 
      responseEncoding: 'utf8', 
    }
    if (!doNotUpdate)
    axios(options)
    .then(function (response) {
      console.log("  Updated Event ",response.data.dataItem.data.title)
    })
    .catch(function (error){
      console.log("Update Event Failed",error.response.status,error.response.statusText,error.response.data)
    })


  })

})
}

function getPreviousSundayDate(today) {
    let dayOfWeek = today.getDay(); // 0 (Sunday) to 6 (Saturday)

    // Calculate how many days ago was the last Sunday
    let daysAgo = dayOfWeek;

    let previousSunday = new Date(today);
    previousSunday.setDate(today.getDate() - daysAgo);

    // Format the date as yyyy-mm-dd
    let year = previousSunday.getFullYear();
    let month = ('0' + (previousSunday.getMonth() + 1)).slice(-2); // Months are zero-indexed
    let day = ('0' + previousSunday.getDate()).slice(-2);

    return `${year}-${month}-${day}`;
}
