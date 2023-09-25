var descriptions = [    
    {type: 5, desc: 'Driver Requested To Talk With The Dispatcher'},
    {type: 13, desc: 'Current Driver Location'},
    {type: 17, desc: 'Trip Accepted by Driver'},
    {type: 20, desc: 'Estimated Time of Arrival'},
    {type: 21, desc: 'Cannot Find Passenger'},
    {type: 22, desc: 'Calling Out Passenger'},
    {type: 23, desc: 'Meter On'},
    {type: 24, desc: 'Meter Off'},
    {type: 25, desc: 'Meter On'},
    {type: 26, desc: 'Meter Off'},
    {type: 27, desc: 'Meter On'},
    {type: 28, desc: 'Meter Off'},
    {type: 29, desc: 'Meter On'},
    {type: 30, desc: 'Meter Off'},
    {type: 31, desc: 'Credit Card Authorization Only'},
    {type: 33, desc: 'Driver In Front'},
    {type: 34, desc: 'Driver Requested Directions'},
    {type: 35, desc: 'Driver is Bidding on this Trip'},
    {type: 36, desc: 'Credit Card Sale Request'},
    {type: 61, desc: 'Trip Cancelled'},
    {type: 101, desc: 'Trip Cancelled'},
    {type: 150, desc: 'Dispatcher Assigned this Trip to this Vehicle'},
    {type: 152, desc: 'Trip Entered'},
    {type: 153, desc: 'Trip Voided'},
    {type: 155, desc: 'Trip Transferred to Another Fleet'},
    {type: 156, desc: 'Trip Information Resent to Driver'},
    {type: 157, desc: 'Trip Re-Dispatched'},
    {type: 160, desc: 'Trip Cancelled'},
    {type: 161, desc: 'Trip Updated'},
    {type: 170, desc: 'Trip Offered to a Driver'},
    {type: 171, desc: 'Trip Information Sent to Driver'},
    {type: 172, desc: 'Driver Failed to Accept a Trip'},
    {type: 174, desc: 'Automatic Customer Call-Out'},
    {type: 177, desc: 'Trip Awarded to this Vehicle Through the Bidding System'}
]

exports.getDescriptions = () => {
    return descriptions;
}

exports.getDescription = (type) => {
    var t = parseInt(type);
    var event = descriptions.find(function(event) {return event.type == t});
    if (event) {
        return event.desc;
    } else {
        return '';
    }
}