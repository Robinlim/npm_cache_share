var createNew = document.getElementById("js-create-new"), //新增策略按钮
    createDialog = document.getElementById("js-create-dialog"), //新增策略弹框
    tableList = document.getElementById("js-table-list"),
    myForm = document.getElementById("js-create-form");

var urlObj = {
    listUrl: "/strategy/api/list",
    addUrl: "/strategy/api/add",
    removeUrl: "/strategy/api/remove?moduleName={name}"
};

var strategy = {
    init: function() {
        this.getList();
        this.bindEvent();
    },
    bindEvent: function() {
        var self = this;

        createNew.addEventListener('click', function() {
            self.renderForm({
                moduleName: '',
                alwaysUpdate: false,
                postInstall: false,
                ignoreCache: false,
                blackList: false,
                postInstallVal: ''
            });
            if(createDialog.style.display === 'none'){
                createDialog.style.display = 'block';
            }
        });

        createDialog.addEventListener('click', function(e) {

            if(e.target.classList.contains('js-confirm-dialog')) {
                self.createStg();
            }

            if(e.target.classList.contains('js-close-dialog') ||
                e.target.classList.contains('js-cancel-dialog')) {
                 createDialog.style.display = 'none';
            }

            if(e.target.classList.contains('js-change-post')){
                if(!e.target.checked){
                    myForm.elements.postInstallVal.value = '';
                }
                myForm.elements.postInstallVal.disabled = !e.target.checked;
            }
        });

        tableList.addEventListener('click', function(e) {

            if(e.target.classList.contains('js-stg-update')) {
                self.modifyStg(e.target);
            }

            if(e.target.classList.contains('js-stg-del')) {
                self.delStg(e.target);
            }
        });
    },
    getList: function() {
        var self = this;
        self.sendAjax('get', urlObj.listUrl, null, function(res) {
            if(res && res.status === 200) {
                self.modules = res.modules;
                self.renderListData(res.modules);
            }
        }, function(res) {
            alert(res.message);
        });
    },
    renderListData: function(data) {
        var html = [];
        for(var key in data) {
            if(data[key]['alwaysUpdate'] || data[key]['ignoreCache'] || data[key]['postInstall'] || data[key]['blackList']) {
                html.push(
                    '<tr class="m-table-row">' +
                        '<td class="column_1"><div class="cell">' + key + '</div></td>' +
                        '<td class="column_2"><div class="cell">' + (data[key]['alwaysUpdate'] || '') + '</div></td>' +
                        '<td class="column_3"><div class="cell">' + (data[key]['ignoreCache'] || '') + '</div></td>' +
                        '<td class="column_4"><div class="cell">' + (data[key]['postInstall'] || '') + '</div></td>' +
                        '<td class="column_5"><div class="cell">' + (data[key]['blackList'] || '') + '</div></td>' +
                        '<td class="column_6">' +
                            '<a class="m-button-small js-stg-update" data-id="' +  key + '" href="javascript:;">修改</a>' +
                            '<a class="m-button-small js-stg-del" data-id="' +  key + '" href="javascript:;">删除</a>' +
                        '</td>' +
                    '</tr>'
                )
            }
        }

        tableList.innerHTML = html.join('');
    },
    createStg: function() {

        var self = this,
            param = self.beforeSubmit();

        if(param) {
            self.sendAjax('post', urlObj.addUrl, JSON.stringify(param), function(res) {
                if(res && res.status === 200) {
                    createDialog.style.display = 'none';
                    myForm.reset();
                    self.getList();
                }
            }, function(res) {
                alert(res.message);
            });
        }
    },
    modifyStg: function(target) {
        myForm.reset();
        createDialog.style.display = 'block';
        var id = target.getAttribute('data-id'),
            curRowData = this.modules[id];
        this.renderForm({
            moduleName: id,
            alwaysUpdate: curRowData.alwaysUpdate == 1,
            ignoreCache: curRowData.ignoreCache == 1,
            blackList: curRowData.blackList == 1,
            postInstall: !!curRowData.postInstall,
            postInstallVal: curRowData.postInstall || ''
        });
        myForm.elements.moduleName.disabled = true;
    },
    delStg: function(target) {
        var self = this;
        var stgId = target.getAttribute('data-id');
        var removeUrl = urlObj.removeUrl.replace('{name}', stgId);
        if(confirm('是否确定删除？')){
            self.sendAjax('get', removeUrl, null, function(res) {
                if(res && res.status === 200) {
                    self.getList();
                    // var item = target.parentNode.parentNode;
                    // tableList.removeChild(item);
                }
            }, function(res) {
                alert(res.message);
            });
        } else {
            return;
        }
    },
    renderForm: function(formData) {
        if(!formData) {
            return;
        }
        myForm.elements.moduleName.value = formData.moduleName;
        myForm.elements.moduleName.disabled = false;
        myForm.elements.alwaysUpdate.checked = formData.alwaysUpdate;
        myForm.elements.ignoreCache.checked = formData.ignoreCache;
        myForm.elements.blackList.checked = formData.blackList;
        myForm.elements.postInstall.checked = formData.postInstall;
        myForm.elements.postInstallVal.value = formData.postInstall ? formData.postInstallVal : '';
        myForm.elements.postInstallVal.disabled = !formData.postInstall;
    },
    beforeSubmit: function() {
        var el = myForm.elements;

        if(el.moduleName.value === '') {
            alert('请输入模块名');
            return null;
        }

        if(!el.alwaysUpdate.checked && !el.ignoreCache.checked && !el.postInstall.checked && !el.blackList.checked) {
            alert('请选择策略');
            return null;
        }

        if(el.postInstall.checked && el.postInstallVal.value === '') {
            alert('请输入postInstall 的策略值');
            return null;
        }

        var formData =  {
            moduleName: el.moduleName.value,
            strategy: {
                alwaysUpdate: el.alwaysUpdate.checked ? 1 : 0,
                ignoreCache: el.ignoreCache.checked ? 1 : 0,
                blackList: el.blackList.checked ? 1 : 0,
                postInstall: el.postInstall.checked ? el.postInstallVal.value : 0
            }
        };

        return formData;
    },
    sendAjax: function(method, url, param, successCallBack, errorCallBack) {

        var xhr = new XMLHttpRequest();

        xhr.open(method, url, true);
        xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
        xhr.responseType = 'json';

        xhr.onload = function() {
            if(this.status == 200){
                if(this.response.status == 200){
                    successCallBack && successCallBack(this.response);
                }else{
                    errorCallBack && errorCallBack(this.response.message);    
                }
            } else {
                errorCallBack && errorCallBack(this.response);
            }
        };
        xhr.onerror = function(e) {
            errorCallBack && errorCallBack(e);
        }
        var type = method.toLowerCase();
        if(type === 'post') {
            xhr.send(param);
        }

        if(type === 'get') {
            xhr.send();
        }
    }
}

strategy.init();
