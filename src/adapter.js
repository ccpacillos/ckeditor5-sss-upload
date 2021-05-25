export default class Adapter {
    constructor(loader, url, mapUrl) {
        this.loader = loader;
        this.url = url;
        this.mapUrl = mapUrl || (({ location }) => location);
    }

    upload() {
        return this.loadFile().then(this.getCredentials().bind(this).then(this.uploadImage.bind(this)));
    }

    abort() {
        if (this.xhr) this.xhr.abort();
    }

    loadFile() {
        return new Promise((resolve, reject) => {
            this.loader.file.then(file => {
                this.file = file;
                resolve();
            })
        })
    }

    getCredentials() {
        return new Promise((resolve, reject) => {

            const filename = this.file.name;
            var xhr = new XMLHttpRequest();

            xhr.withCredentials = false;
            xhr.open('GET', this.url + '?filename=' + filename, true);
            xhr.responseType = 'json';
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.addEventListener('error', err => reject('crederr'));
            xhr.addEventListener('abort', err => reject('credabort'));
            xhr.addEventListener('load', function () {
                var res = xhr.response;

                if (!res) return reject('No response from s3 creds url');

                resolve(res);
            });

            xhr.send();

        });
    }

    uploadImage(s3creds) {
        return new Promise((resolve, reject) => {

            var data = new FormData();

            for (var param in s3creds.params) {
                if (!s3creds.params.hasOwnProperty(param)) continue;

                data.append(param, s3creds.params[param]);
            }

            data.append('Content-Type', this.file.type)

            data.append('file', this.file);

            var xhr = this.xhr = new XMLHttpRequest();

            xhr.withCredentials = false;
            xhr.responseType = 'document';

            xhr.addEventListener('error', err => reject('s3err'));
            xhr.addEventListener('abort', err => reject('s3abort'));
            xhr.addEventListener('load', () => {
                const res = xhr.response;

                if (!res) return reject('No Response');

                if (res.querySelector('Error')) {
                    return reject(res.querySelector('Code').textContent + ': ' + res.querySelector('Message').textContent);
                }

                const info = {
                    location: res.querySelector('Location').textContent,
                    bucket: res.querySelector('Bucket').textContent,
                    key: res.querySelector('Key').textContent,
                    etag: res.querySelector('ETag').textContent
                };

                if (!info.location) {
                    return reject('NoLocation: No location in s3 POST response');
                }

                resolve({ default: this.mapUrl(info) });
            });

            if (xhr.upload) {
                xhr.upload.addEventListener('progress', e => {
                    if (!e.lengthComputable) return;

                    this.loader.uploadTotal = e.total;
                    this.loader.uploaded = e.loaded;
                });
            }

            xhr.open('POST', s3creds.endpoint_url, true);
            xhr.send(data);

        });
    }
}
