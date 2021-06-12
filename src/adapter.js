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
            const [fileBaseType] = this.file.type.split('/');
            const fileUploadInfo = {
              id: Math.floor(Math.random() * 100),
              type: fileBaseType,
              filename: this.file.name,
              progress: 0,
              uploaded: false,
              error: null,
            };

            this.setLocalStorageUploadInfo(fileUploadInfo);

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


            xhr.addEventListener('error', err => {
                this.updateLocalStorageOnError(fileUploadInfo.id, err);
                reject('s3err');
            });
            xhr.addEventListener('abort', err => {
              this.updateLocalStorageOnError(fileUploadInfo.id, err);
                reject('s3abort');
            });
            xhr.addEventListener('load', () => {
                const res = xhr.response;

                if (!res) {
                  const error = 'No Response.';
                  this.updateLocalStorageOnError(fileUploadInfo.id, error);
                  return reject(error);
                };

                if (res.querySelector('Error')) {
                    const error = res.querySelector('Code').textContent + ': ' + res.querySelector('Message').textContent;
                    this.updateLocalStorageOnError(fileUploadInfo.id, error);
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
                    this.updateLocalStorageOnError(fileUploadInfo.id, error);
                    return reject(error);
                }

                fileUploadInfo.progress = 100;
                fileUploadInfo.uploaded = true;

                this.setLocalStorageUploadInfo(fileUploadInfo);
                setTimeout(() => {
                  this.clearUploadInfo(fileUploadId);
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
                    this.setLocalStorageUploadInfo(fileUploadInfo);
                });
            }

            xhr.open('POST', s3creds.endpoint_url, true);
            xhr.send(data);
        });
    }

    setLocalStorageUploadInfo(info) {
      const currentLocalStorageData = JSON.parse(
        window.localStorage.getItem(LOCAL_STORAGE_KEY) || '[]'
      );

      const localStorageDataWithoutOldInfo = currentLocalStorageData.filter(
        ({ id }) => info.id !== id
      );

      localStorageDataWithoutOldInfo.push(info);

      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(localStorageDataWithoutOldInfo)
      )
    }

    updateLocalStorageOnError(fileUploadId, error) {
      const currentLocalStorageData = JSON.parse(
        window.localStorage.getItem(LOCAL_STORAGE_KEY) || '[]'
      );

      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(currentLocalStorageData.map(
          (fileUploadInfo) => {
            return {
              ...fileUploadInfo,
              error: fileUploadId === fileUploadInfo.id ? error : null,
            };
          }
        ))
      )

      setTimeout(() => {
        this.clearUploadInfo(fileUploadId);
      }, 3000);
    }

    clearUploadInfo(fileUploadId) {
      const currentLocalStorageData = JSON.parse(
        window.localStorage.getItem(LOCAL_STORAGE_KEY) || '[]'
      );

      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(
          currentLocalStorageData.filter(({ id }) => fileUploadId !== id)
        )
      );
    }
}
