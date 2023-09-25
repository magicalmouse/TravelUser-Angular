# Taxi Accounts Portal Lambda

## Lambda Name:

businessPortal

## API URLs

(BusinessPortal in API Gateway)

-   Production: https://7188s13ttk.execute-api.us-east-2.amazonaws.com/prod
-   Testing: https://7188s13ttk.execute-api.us-east-2.amazonaws.com/test

## Description

This Lambda function provides most of the backend for the Fleet Management Portal site. The Fleet Management Portal client also uses a few mutations from a separate [GraphQL API](https://github.com/N-T-S/AppSync_Driver_App) for some utilities.

**Note: Some data requires synchronization between the MSSQL tables and the DynamoDB tables.**

## Installation

**Note: In order to connect to the MSSQL databases, the code must be run using a VPC that can connect to CCSi's and BNL's private networks. Because of this, the best way to run the code is through the Lambda function as it is connected to a VPC.**

**Note: The aws-sdk package is only required when running this on your local machine. AWS Lambda functions automatically provide the sdk. If you need to re-upload the node_modules folder to the Lambda function, make sure aws-sdk is not included in the node_modules.**

To run on local machine:

```bash
npm install
npm install aws-sdk
```

## Testing

Code changes to the $LATEST (unqualified) version will not affect production until a new version is published and the **prod** alias is pointed at the new version. (See **Releasing New Version**)

## Releasing New Version

This lambda function has two aliases: **prod** and **test**. To release a new version of the code, click the **Actions** dropdown and choose **Publish new version**. Once the new version is published, choose **Aliases** and edit the **prod** alias to point to the new version. This will **immediately** affect the production application.

If uploading a zip file to the lambda function, zip all of the files in the **lambda** folder, rather than the folder itself. The JavaScipt files should be at the root level of the lambda function.

Note: The **test** alias should remain pointed at version $LATEST.

## DynamoDB Tables

-   userPermissions
-   Accounts **(not currently in use)**
-   Portal_MobileAppAuths
-   authTokens

## MSSQL Tables

-   XWebUser
-   XWebUserAccount
-   XDispFleetSettings
-   CUSTINFO2
-   Customer
-   FLEET
-   XDispClient4MyCabAuths
-   XDispTrips
-   XDispCities
-   CALLS (archives for trips)
-   XDispExceptionCodes
-   XDispActExcepts
-   XDispEvents
-   XDispEventStatus
-   EVENTS (archives for trip events)
-   XDispVehicle
