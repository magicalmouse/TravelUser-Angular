# Taxi Account Portal

## Description

The Taxi Account Portal is primarily used for updating settings and managing other data related to the Dispatch (Driver) Application and PIM Application.
The web client is built in Angular and uses both an API Gateway API.

This repository is divided into two folders: **client** and **lambda**. Each folder contains a README file that provides more detail about that part of the FMP.

**Note: The /lambda directory contains server code used for both the Taxi Account Portal and the [Taxi Account Admin Portal](https://github.com/N-T-S/Portal_Taxi_Account_Admin).  
Both sites use the same Lambda function in AWS.**

## AWS Services Used:

-   Lambda
-   API Gateway
-   S3
-   CloudFront
-   DynamoDB

## Other Services Used:

-   MSSQL
-   NameCheap
