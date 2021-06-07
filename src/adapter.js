const LOCAL_STORAGE_KEY = 'ck-editor-identifi-upload';

export default class Adapter {
    constructor(loader, url, token) {
        this.loader = loader;
        this.url = url;
        this.token = token;
    }

    upload() {
        return this.loadFile().then(() => {
            return this.getCredentials().then(this.uploadImage.bind(this));
        });
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

            const [fileBaseType] = this.file.type.split('/');
            xhr.withCredentials = false;
            xhr.open('GET', this.url + '?filename=' + filename + '&baseType=' + fileBaseType, true);
            xhr.responseType = 'json';
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);

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
            const localStorageInfo = JSON.parse(
              window.localStorage.getItem(LOCAL_STORAGE_KEY) || '[]'
            );
            const [fileBaseType] = this.file.type.split('/');
            const temporaryUniqueId = Math.floor(Math.random() * 100);
            const fileUploadInfo = {
              id: temporaryUniqueId,
              type: fileBaseType,
              filename: this.file.name,
              progress: 0,
              uploaded: false,
              error: null,
            };
            localStorageInfo.push(fileUploadInfo);
            window.localStorage.setItem(
              LOCAL_STORAGE_KEY,
              JSON.stringify(localStorageInfo)
            );

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

            const updateLocalStorageOnError = (err) => {
              console.log(err);
              fileUploadInfo.error = err;
              window.localStorage.setItem(
                LOCAL_STORAGE_KEY,
                JSON.stringify(localStorageInfo)
              );
              setTimeout(() => {
                window.localStorage.setItem(
                  LOCAL_STORAGE_KEY,
                  JSON.stringify(localStorageInfo.filter(({ id }) => temporaryUniqueId !== id))
                );
              }, 3000);
            }

            xhr.addEventListener('error', err => {
                updateLocalStorageOnError(err);
                reject('s3err');
            });
            xhr.addEventListener('abort', err => {
                updateLocalStorageOnError(err);
                reject('s3abort');
            });
            xhr.addEventListener('load', () => {
                const res = xhr.response;

                if (!res) {
                  const error = 'No Response.';
                  updateLocalStorageOnError(error);
                  return reject(error);
                };

                if (res.querySelector('Error')) {
                    const error = res.querySelector('Code').textContent + ': ' + res.querySelector('Message').textContent;
                    updateLocalStorageOnError(error);
                    return reject(error);
                }

                const info = {
                    location: res.querySelector('Location').textContent,
                    bucket: res.querySelector('Bucket').textContent,
                    key: res.querySelector('Key').textContent,
                    etag: res.querySelector('ETag').textContent
                };

                if (!info.location) {
                    const error = 'NoLocation: No location in s3 POST response';
                    updateLocalStorageOnError(error);
                    return reject(error);
                }

                fileUploadInfo.progress = 100;
                fileUploadInfo.uploaded = true;

                window.localStorage.setItem(
                  LOCAL_STORAGE_KEY,
                  JSON.stringify(localStorageInfo)
                );

                setTimeout(() => {
                  window.localStorage.setItem(
                    LOCAL_STORAGE_KEY,
                    JSON.stringify(
                      localStorageInfo.filter(({ id }) => temporaryUniqueId !== id)
                    )
                  );
                }, 3000);

                resolve({
                    default: s3creds.file_url
                });
            });

            if (xhr.upload) {
                xhr.upload.addEventListener('progress', e => {
                    if (!e.lengthComputable) return;

                    this.loader.uploadTotal = e.total;
                    this.loader.uploaded = e.loaded;

                    fileUploadInfo.progress = e.total;
                    window.localStorage.setItem(
                      LOCAL_STORAGE_KEY,
                      JSON.stringify(localStorageInfo)
                    );
                });
            }

            xhr.open('POST', s3creds.endpoint_url, true);
            xhr.send(data);
        });
    }

}
