# insta-mcp

I have updated the code in `server/src/tools/instagramPostImage.ts` to fetch user credentials from a `user.json` file. I have also created a template `user.json` file at the root of your project and updated your `.gitignore` to prevent this file from being committed.

Please open the `user.json` file and replace the placeholder values with your actual Instagram user data.

The `user.json` file must have the following structure:

```json
{
  "id": "YOUR_USER_ID",
  "name": "YOUR_NAME",
  "accessToken": "YOUR_ACCESS_TOKEN",
  "refreshToken": "YOUR_REFRESH_TOKEN",
  "expiresIn": 0,
  "picture": "YOUR_PICTURE_URL",
  "username": "YOUR_USERNAME"
}
```

This change makes it so you don't have to pass your credentials every time you use the tool. Let me know if you have any other questions!
