# Taxi Account Portal Client

## Description

This Angular client provides the frontend for the Taxi Account Portal site. The client is hosted in the S3 bucket **portal.nts.taxi**. The client uses both an API Gateway API.
The Taxi Account Portal is used for managing trips, booking trips, and managing users.

This client uses the external appAuthentication Lambda function for authentication (login, logout, etc.).

**Note: also see the [TaxiAccountPortalDocumentation](https://portal.nts.taxi/assets/files/TaxiAccountPortalDocumentation.pdf) PDF file for more general information about the client.**

## Installation

```bash
npm install
```

To run on local machine:

```bash
ng serve --open
```

## Releasing New Version

**Note: The public facing url (https://portal.nts.taxi) is routed through AWS CloudFront. This means that changes in the new version will not be reflected until the cache has been invalidated for the CloudFront distribution.**

**Note: Make sure that any urls being used within the application are set to the production stage before releasing a new version.**

1. To release a new version of the FMP client, the Angular code must first be compiled:
    ```bash
    ng build --prod
    ```
    This will create the **dist/** folder that contains the files to be uploaded.
2. Navigate to the **portal.nts.taxi** S3 bucket.
3. To avoid duplicates, delete all files in the S3 bucket **except for the assets/ folder**.
4. Upload the files contained in the **dist/** folder on your local machine. **Note: In order to allow the website to use the files, the ACL Permission for Read Objects must be granted to Everyone (public access). Set this permission when uploading the files. See image below.**  
   ![](./docs/ACLPermissions.png)
5. Verify that the website is working correctly by viewing the [website endpoint](http://portal.nts.taxi.s3-website.us-east-2.amazonaws.com) for the S3 bucket.
6. If everything looks good, navigate to AWS CloudFront and select the distribution attached to **portal.nts.taxi**.
7. Choose the **Invalidations** tab and click **Create Invalidation**. Set /\* as the object path and create the invalidation.
   **This invalidates the cache and allows CloudFront to serve the updated files in the S3 bucket.**
8. Navigate to [https://portal.nts.taxi](https://portal.nts.taxi) and verify that the update application is working. (A hard-refresh of the browser page may be required to view the update.)

## API URLs

(BusinessPortal in API Gateway)

-   Production: https://7188s13ttk.execute-api.us-east-2.amazonaws.com/prod
-   Testing: https://7188s13ttk.execute-api.us-east-2.amazonaws.com/test

(appAuthentication-API in API Gateway)

-   Authorization: https://9lwaroch9i.execute-api.us-east-2.amazonaws.com/prod

## Components

-   AccountsComponent
    > Acts as the landing page for the web app. This component shows trip statistics and a list of the accounts a user has access to and the actions they are authorized to perform for that account.
-   ActivateTripsComponent **(Not currently in use)**
-   AdminTasksComponent
    > The “Manage Users” page can be used by Primary Contacts and Users with management access
    > to add new users, edit existing users, view details on the users, and delete existing users. Users
    > that do not have management access will only be able to view the list of users.
-   CompleteRegistrationComponent
    > This component will only be accessible via a link in an email. This component is for new users to finish their registration by setting their password.
-   InvoiceComponent **(Not currently in use)**
-   LoginComponent
    > Shown to an unauthenticated user. Allows the user to log in.
-   MobileAppBookingComponent
    > Used to add or remove users that are
    > authorized to reserve trips by mobile application for the selected account.
    -   MobileDialogComponent
-   PhoneBookingComponent
    > Used to add or remove users that are
    -   NameDialogComponent
        authorized to reserve trips by phone for the selected account.
-   ResetPasswordComponent
    > Allows a user to reset their password.
    >
    > This page is linked in an email to an existing user once they have used the **Forgot Password?** option on the LoginComponent page.
-   TrackTripsComponent
    > This component displays a list of trips for the selected account. The list displays information about each trip as well as options available for the trip.
    -   MapDialogComponent
    -   EventsDialogComponent
    -   DetailsDialogComponent
-   UserProfileComponent
    > Allows a user to change their name, password, and profile picture.
    -   UserDialogComponent
    -   ProfilePhotoDialogComponent
-   AppComponent
    FeedbackDialogComponent
    MaintenanceNotificationDialogComponent

## Services

-   MessageDialogComponent
-   ConfirmDialogComponent
-   PaginationService
-   SharedService
-   SaveUserService
-   SaveMobileService
-   SavePhoneService
-   ExportService
-   SavePhotoService
