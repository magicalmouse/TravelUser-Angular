const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-2'});
const Connection = require('tedious').Connection;
const Request = require('tedious').Request;
const util = require('./util');
let gCallback;

function Account() {
    this.addr1 = '';
    this.addr2 = '';
    this.city = '';
    this.state = '';
    this.zip = '';
    this.phone = '';
    this.attn = '';
    this.fax = '';
    this.billAttn = '';
    this.billAddr1 = '';
    this.billAddr2 = '';
    this.billCity = '';
    this.billState = '';
    this.billZip = '';
    this.billPhone = '';
    this.billFax = '';
}

exports.accountProfile = (event, dbConfig, callback) => {
    gCallback = callback;
    let action = parseInt(event.updateAction)
    if (action === util.ACTION_GET_SIGNED_URL) {
        getSignedUrl(event);
        return;
    } else if (action === util.ACTION_UPDATE_ACCOUNT_LOGO) {
        updateAccountLogo(event);
        return;
    } else if (action === util.ACTION_GET_ACCOUNT_LOGO) {
        getAccountLogo(event);
        return;
    } else if (action === util.ACTION_GET_ACCOUNT_INFO) {
        getAccountInfo(event, dbConfig);
        return;
    } else if (action === util.ACTION_UPDATE_ACCOUNT_INFO) {
        updateAccountInfo(event);
        return;
    } else if (action === util.ACTION_DELETE_ACCOUNT_LOGO) {
        deleteAccountLogo(event);
    }
}


const getAccountInfo = (event, dbConfig) => {
    const accountNbr = event.accountNbr;
    const fleetId = event.fleetId;

    // first check if account record in dynamo table

    const params = {
        TableName: 'Accounts',
        Key: {
            accountNbr,
            fleetId
        }
    }
    const docClient = new AWS.DynamoDB.DocumentClient();
    docClient.get(params, (err, data) => {
        if (err) {
            gCallback(null, util.configureResponse({status: 'ERROR', error: err}));
            return;
        } else {
            if (data.Item && data.Item.addr1 != null) {
                // if account profile information exists in the record
                // return the account information
                // Note: record may exist with blank profile information 
                const account = data.Item;
                for (const key in account) {
                    if (account.hasOwnProperty(key)) {
                      if (account[key] === ' ') {
                        account[key] = '';
                      }
                    }
                }
                gCallback(null, util.configureResponse({status: 'OK', account}));
                return;
            } else {
                // account profile information does not exist in dynamo
                // pull account profile information from sql database
                callsqlDatabase(accountNbr, fleetId, dbConfig);
            }
        }
    })

}

const callsqlDatabase = (accountNbr, fleetId, dbConfig) => {
    let conn = new Connection(dbConfig);
    conn.on('connect', (err) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err}));
            return;
        } else {
            let account = new Account();
            const sql = `
                SELECT Addr1, Addr2, City, State, Zip, Phone, Attn, Fax, BillAttn, BillAddr1, BillAddr2, BillCity, BillState, BillZip, BillPhone, BillFax FROM Customer
                WHERE CustId = '${accountNbr}' AND FleetId = '${fleetId}'`;
            
            let request = new Request(
                sql,
                (err, rowCount, rows) => {
                    if (err) {
                        gCallback(null, util.configureResponse({status: 'ERROR', error: err}));
                        conn.close();
                    } else {
                        for (const key in account) {
                            if (account.hasOwnProperty(key)) {
                              if (account[key] === '') {
                                account[key] = ' ';
                              }
                            }
                          }
                        gCallback(null, util.configureResponse({status: 'OK', account: account}));
                        conn.close();
                    }
            });
            
            request.on('row', (columns) => {
                columns.forEach((column) => {
                    switch(column.metadata.colName) {
                        case 'Addr1':
                            account.addr1 = column.value.trim();
                            break;
                        case 'Addr2':
                            account.addr2 = column.value.trim();
                            break;
                        case 'City':
                            account.city = column.value.trim();
                            break;
                        case 'State':
                            account.state = column.value.trim();
                            break;
                        case 'Zip':
                            account.zip = column.value.trim();
                            break;
                        case 'Phone':
                            account.phone = column.value.trim();
                            break;
                        case 'Attn':
                            account.attn = column.value.trim();
                            break;
                        case 'Fax':
                            account.fax = column.value.trim();
                            break;
                        case 'BillAttn':
                            account.billAttn = column.value.trim();
                            break;
                        case 'BillAddr1':
                            account.billAddr1 = column.value.trim();
                            break;
                        case 'BillCity':
                            account.billCity = column.value.trim();
                            break;
                        case 'BillState':
                            account.billState = column.value.trim();
                            break;
                        case 'BillZip':
                            account.billZip = column.value.trim();
                            break;
                        case 'BillPhone':
                            account.billPhone = column.value.trim();
                            break;
                        case 'BillFax':
                            account.billFax = column.value.trim();
                            break;
                    }
                });
            });

            conn.execSql(request);
        }
    })
}

const updateAccountInfo = (event) => {
    const accountNbr = event.accountNbr;
    const fleetId = event.fleetId;

    // first check if account record in dynamo table

    const params = {
        TableName: 'Accounts',
        Key: {
            accountNbr,
            fleetId
        }
    }
    const docClient = new AWS.DynamoDB.DocumentClient();
    docClient.get(params, (err, data) => {
        if (err) {
            gCallback(null, util.configureResponse({status: 'ERROR', error: err}));
            return;
        } else {
            for (const key in event) {
                if (event.hasOwnProperty(key)) {
                  if (event[key] === '') {
                    event[key] = ' ';
                  }
                }
            }
            const account = {
                accountNbr,
                fleetId,
                addr1: event.addr1,
                addr2: event.addr2,
                city: event.city,
                state: event.state,
                zip: event.zip,
                phone: event.phone,
                attn: event.attn,
                fax: event.fax,
                billAttn: event.billAttn,
                billAddr1: event.billAddr1,
                billAddr2: event.billAddr2,
                billCity: event.billCity,
                billState: event.billState,
                billZip: event.billZip,
                billPhone: event.billPhone,
                billFax: event.billFax
            }
            let params;
            if (data.Item) {
                params = {
                    TableName: 'Accounts',
                    Key: {
                        accountNbr,
                        fleetId
                    },
                    UpdateExpression: 'set addr1 = :a1, addr2 = :a2, city = :c, #s = :s, zip = :z, phone = :p, attn = :attn, fax = :f, billAttn = :battn, billAddr1 = :ba1, billAddr2 = :ba2, billCity = :bc, billState = :bs, billZip = :bz, billPhone = :bp, billFax = :bf',
                    ExpressionAttributeNames: {
                        '#s': 'state'
                    },
                    ExpressionAttributeValues: {
                        ':a1': event.addr1,
                        ':a2': event.addr2,
                        ':c': event.city,
                        ':s': event.state,
                        ':z': event.zip,
                        ':p': event.phone,
                        ':attn': event.attn,
                        ':f': event.fax,
                        ':battn': event.billAttn,
                        ':ba1': event.billAddr1,
                        ':ba2': event.billAddr2,
                        ':bc': event.billCity,
                        ':bs': event.billState,
                        ':bz': event.billZip,
                        ':bp': event.billPhone,
                        ':bf': event.billFax
                    }
                }
                updateAccount(params, account);
            } else {
                // create account
                params = {
                    TableName: 'Accounts',
                    Item: {
                        accountNbr,
                        fleetId,
                        addr1: event.addr1,
                        addr2: event.addr2,
                        city: event.city,
                        state: event.state,
                        zip: event.zip,
                        phone: event.phone,
                        attn: event.attn,
                        fax: event.fax,
                        billAttn: event.billAttn,
                        billAddr1: event.billAddr1,
                        billAddr2: event.billAddr2,
                        billCity: event.billCity,
                        billState: event.billState,
                        billZip: event.billZip,
                        billPhone: event.billPhone,
                        billFax: event.billFax
                        
                    }
                }
                createAccount(params, account);
            }
        }
    })
    
}


const getSignedUrl = (event) => {
    if (event.accountNbr && event.fleetId) {
        const key = event.accountNbr + '_' + event.fleetId + '.png';
        const s3 = new AWS.S3({
            signatureVersion: 'v4',
            region: 'us-east-2'
        });
        const params = {
            Bucket: 'account-logos',
            Key: key,
            Expires: 3600,
            ACL: 'public-read'
        }

        s3.getSignedUrl('putObject', params, (err, url) => {
            if (err) {
                // return error : AWS error
                gCallback(null, util.configureResponse({status: 'SIGNED_URL_ERROR', error: err}));
                return;
            } else {
                // return success response w/ url
                gCallback(null, util.configureResponse({status: 'OK', url: url}));
                return;
            }   
        })
    }
}

const updateAccountLogo = (event) => {
    if (event.fleetId && event.accountNbr) {
        let params = {
            TableName: 'Accounts',
            Key: {
                accountNbr: event.accountNbr,
                fleetId: event.fleetId
            }
        }

        const docClient = new AWS.DynamoDB.DocumentClient();
        docClient.get(params, (err, data) => {
            if (err) {
                // return error: AWS error
                gCallback(null, util.configureResponse({status: 'ACCOUNT_UPDATE_ERROR', error: err}));
                return;
            } else {
                const url = 'https://account-logos.s3.us-east-2.amazonaws.com/'+ event.accountNbr + '_' + event.fleetId + '.png';
                if (data.Item) {
                    // account already in dynamo table
                    let account = data.Item;
                    if (account.accountLogo && account.accountLogo === url) {
                        // return success response
                        gCallback(null, util.configureResponse({status: 'OK', accountLogo: account.accountLogo}));
                        return;
                    } else {
                        params = {
                            TableName: 'Accounts',
                            Key: {
                                accountNbr: event.accountNbr,
                                fleetId: event.fleetId
                            },
                            UpdateExpression: 'SET accountLogo = :a, accountName = :n',
                            ExpressionAttributeValues: {
                                ':a': url,
                                ':n': event.accountName
                            }
                        }
                        updateAccount(params, url);
                    }

                } else {
                    const params = {
                        TableName: 'Accounts',
                        Item: {
                            accountNbr: event.accountNbr,
                            fleetId: event.fleetId,
                            accountName: event.accountName,
                            accountLogo: url
                        }
                    }
                    createAccount(params, url);
                }
            }
        })
    }
}

const createAccount = (params, account) => {
    const docClient = new AWS.DynamoDB.DocumentClient();
    docClient.put(params, (err, data) => {
        if (err) {
            // return error : AWS error
            gCallback(null, util.configureResponse({status: 'ACCOUNT_UPDATE_ERROR', error: err}));
            return;
        } else {
            gCallback(null, util.configureResponse({status: 'OK', account}));
            return;
        }
    })
}

const updateAccount = (params, account) => {
    const docClient = new AWS.DynamoDB.DocumentClient();
    docClient.update(params, (err, data) => {
        if (err) {
            // return error : AWS error
            gCallback(null, util.configureResponse({status: 'ACCOUNT_UPDATE_ERROR', error: err}));
            return;
        } else {
            gCallback(null, util.configureResponse({status: 'OK', account}));
            return;
        }
    })
}


const getAccountLogo = (event) => {
    const params = {
        TableName: 'Accounts',
        Key: {
            accountNbr: event.accountNbr,
            fleetId: event.fleetId
        }
    }

    let defaultLogo = 'https://account-logos.s3.us-east-2.amazonaws.com/default.png';

    const docClient = new AWS.DynamoDB.DocumentClient();
    docClient.get(params, (err, data) => {
        if (err) {
            // return error : AWS error
            gCallback(null, util.configureResponse({status: 'GET_ACCOUNT_LOGO_ERROR', error: err}));
            return;
        } else {
            if (data.Item) {
                const account = data.Item;
                if (account.accountLogo && account.accountLogo !== " ") {
                    // return success response 
                    gCallback(null, util.configureResponse({status: 'OK', accountLogo: account.accountLogo}));
                    return;
                } else {
                    // no logo found for the record
                    // return default image
                    gCallback(null, util.configureResponse({status: 'OK', accountLogo: defaultLogo}));
                    return;
                }
            } else {
                // no record exists for the account
                // return default image
                gCallback(null, util.configureResponse({status: 'OK', accountLogo: defaultLogo}));
                return;
            }
        }
    })
}

const deleteAccountLogo = (event) => {
    let defaultLogo = 'https://account-logos.s3.us-east-2.amazonaws.com/default.png';
    let params = {
        TableName: 'Accounts',
        Key: {
            accountNbr: event.accountNbr,
            fleetId: event.fleetId
        },
        UpdateExpression: 'REMOVE accountLogo'
    }

    const docClient = new AWS.DynamoDB.DocumentClient();
    docClient.update(params, (err, data) => {
        if (err) {
            // return error : AWS error
            gCallback(null, util.configureResponse({status: 'DELETE_ACCOUNT_LOGO_ERROR', error: err}));
            return;
        } else {
            const s3 = new AWS.S3({
                region: 'us-east-2'
            });
            const key = event.accountNbr + '_' + event.fleetId + '.png';
            params = {
                Bucket: 'account-logos', 
                Key: key
            };
            s3.deleteObject(params, (err, data) => {
                if (err) {
                    // return error : AWS error
                    gCallback(null, util.configureResponse({status: 'DELETE_ACCOUNT_LOGO_ERROR', error: err}));
                    return;
                } else {
                    gCallback(null, util.configureResponse({status: 'OK', accountLogo: defaultLogo}));
                    return;
                }
            });
            
        }
    })
}
