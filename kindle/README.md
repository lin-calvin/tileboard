# Tileboard Kindle Client

A lightweight Go application that fetches a PNG image and displays it on a jailbroken Kindle using the `eips` command.

## Usage

### Compilation

```bash
make FETCH_URL=http://YOUR_TILEBOARD_SERVER_ADDRESS/png INTERVAL=1s ROTATE=90
```



### Deployment

1. Transfer the compiled `tileboard_kindle` binary to your jailbroken Kindle device.

2. Run the application on the Kindle.

3. Ensure that the viewport size configured on your Tileboard server matches the actual Kindle screen resolution.
