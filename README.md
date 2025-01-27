## S3 Image Upload Plugin for Ckeditor5

This is a fork of https://github.com/pourquoi/ckeditor5-simple-upload, that substitutes standard upload support for direct to S3 uploads.

### Build Integration

https://docs.ckeditor.com/ckeditor5/latest/builds/guides/development/custom-builds.html

`npm install ckeditor5-sss-upload`

Add this plugin and remove the ckfinder and easyimage plugins

```javascript
// build-config.js

module.exports = {
  // ...

  plugins: [
    "@ckeditor/ckeditor5-essentials/src/essentials",
    // ...

    //'@ckeditor/ckeditor5-adapter-ckfinder/src/uploadadapter',
    //'@ckeditor/ckeditor5-easy-image/src/easyimage',

    "ckeditor5-sss-upload/src/s3upload"

    // ...
  ],

  // ...

  config: {
    toolbar: {
      items: [
        "headings",
        "bold",
        "italic",
        "imageUpload",
        "link",
        "bulletedList",
        "numberedList",
        "blockQuote",
        "undo",
        "redo"
      ]
    }
    // ...
  }
};
```

### Configuration

```javascript
ClassicEditor.create(document.querySelector("#editor"), {
  s3Upload: {
    policyUrl: "http://127.0.0.1/my-upload-endpoint",
    token: "user.access.jwt"
  }
});
```

### Backend

The endpoint will receive `filename` and `baseType` query parameters, and will need to respond with s3 credentials JSON in the following format.

```json
{
    "endpoint_url": " ... ",
    "file_url": "...",
    "params": {
        "key": " ... ",
        "acl": " ... ",
        "success_action_status": " ... ",
        "policy": " ... ",
        "x-amz-algorithm": " ... ",
        "x-amz-credential": " ... ",
        "x-amz-date": " ... ",
        "x-amz-signature": " ... "
    }
}
```
- `endpoint_url` -  endpoint to S3 to be used for upload.
- `file_url` - the resulting url of the uploaded file.
- `params` - upload params.
