﻿var _appTemplate;
var _agentTemplate;
var _taskTemplate;
var _packageTemplate;
var _manageAgentDialogTemplate;
var _updateAgentsTemplate;
var _addAgentFormTemplate;
var _agentPackageLogFolderTemplate, _logFileListTemplate, _logFileTemplate;
var _updateInterval = 6 * 1000;
var agentsListView = null, addAgentFormView=null, updateAgentsToVersionView=null;
var _apiBaseUrl = '/api';
var _manageAgentDialogOpen = false;

(function ($) {
    var PackageModel = Backbone.Model.extend({
        defaults: {
            id: '',
            version: '',
            something: ''
        }
    });

    /* MODELS */
    var Agent = Backbone.Model.extend({
        defaults: {
            id: '',
            tags: '',
            packages: [],
            currentTasks: [],
            environment: 'unknown',
            contacted: false,
            selected: false
        },
        urlRoot: _apiBaseUrl + '/agent'
    });

    var Version = Backbone.Model.extend();

    var AgentList = Backbone.Collection.extend({
        model: Agent,
        url: _apiBaseUrl + '/agent'
    });

    var VersionList = Backbone.Collection.extend({
        model: Version,
        url: _apiBaseUrl + '/versionlist'
    });

    var AgentLogFile = Backbone.Model.extend({
        url: function () { return _apiBaseUrl + '/log/' + this.hostname + '/'+this.packageId + '/' + this.fileName; }
    });

    var AgentLogCollection = Backbone.Collection.extend({
       model: AgentLogFile,
       url: function () { return _apiBaseUrl + '/log/' + this.hostname+ '/' + this.packageId; }
    });

    var AgentLogFolder = Backbone.Model.extend({
        model: AgentLogFile,
        url: _apiBaseUrl + '/log/:hostname/:packageId'
    });

    var AgentLogFolderCollection = Backbone.Collection.extend({
        model: AgentLogFolder,
        url: function () { return _apiBaseUrl + '/log/' + this.hostname;}
    });

    /* VIEWS */
    var AgentLogFileView = Backbone.View.extend({
        tagName: 'div',
        container: 'div#app',
        initialize: function () {
            _.bindAll(this, 'render');
            this.model = new AgentLogFile();
        },
        load: function (hostname, packageId, fileName) {
            this.model.hostname = hostname;
            this.model.packageId = packageId;
            this.model.fileName = fileName;
            this.model.fetch({ success: this.render });
        },
        render : function () {
            var that = this;
            console.log('render log file');
            var content = _.template(_logFileTemplate, this.model);
            this.$el.html(content);
            this.$el.detach();
            $(this.container).append(this.$el);
        },
       show: function (){ this.$el.show();},
       hide: function (){ this.$el.hide();}
    });


    var AgentLogFolderView = Backbone.View.extend({
       tagName:'div',
       container: 'div#app',
       initialize: function () {
           _.bindAll(this, 'render');
           console.log('initialise agent log folder view');
           this.collection = new AgentLogCollection();
       },
       load: function (hostname, packageId) {
           console.log('load log files for package ' + packageId + ' on agent ' + hostname);
           this.collection.hostname = hostname;
           this.collection.packageId = packageId;
           this.collection.fetch({ success: this.render });
       },
       render: function () {
           console.log('render logs for ' + this.collection.packageId + ' on agent ' + this.collection.hostname);
           var content = _.template(_logFileListTemplate, this.collection);
           this.$el.html(content);
           this.$el.detach();
           $(this.container).append(this.$el);
       },
       show: function (){ this.$el.show();},
       hide: function (){ this.$el.hide();}
    });


    var AgentLogFolderCollectionView = Backbone.View.extend({
       tagName: 'div',
       container: 'div#app',
       initialize: function () {
           _.bindAll(this, 'render');
           console.log('initialise agent log folder collection view');
           this.collection = new AgentLogFolderCollection();
            this.collection.bind('change', this.update);
            this.collection.bind('destroy', this.render);
            this.collection.bind('add', this.render);
           
       },
       load: function (hostname) {
           console.log('load log folders for ' + hostname);
           this.collection.hostname = hostname;
           this.collection.fetch({ success:this.render });
       },
       render: function () {
           var that = this;
           console.log('render log folders for ' + this.collection.hostname);
           var content = _.template(_agentPackageLogFolderTemplate, this.collection);
           this.$el.html(content);
           this.$el.detach();
           $(this.container).append(this.$el);
       },
       show: function () { this.$el.show();},
       hide: function () { this.$el.hide();}
    });

    var AgentView = Backbone.View.extend({
        tagName: 'li',
        container: 'ul#agents',
        selected: false,
        events: {
            'click a.unregister-agent': 'unregister',
            'click a.manage-agent': 'manage'/*,
            'click a.agent-logs': 'viewLogs'*/
        },
        initialize: function () {
            _.bindAll(this, 'render', 'manage', 'unregister');

            this.model.bind('change', this.update);
            this.model.bind('destroy', this.render);
            this.model.bind('add', this.render);
        },
        update: function (agent) {
            this.model = agent;
            this.render();
            console.log('agent updated');
        },
        render: function (target) {
            var checked = $('input:checked', this.$el).length > 0;

            var viewModel = {
                hostname: this.model.get('id'),
                tags: this.model.get('tags'),
                packages: this.model.get('packages'),
                currentTasks: this.model.get('currentTasks'),
                availableVersions: this.model.get('availableVersions'),
                environment: this.model.get('environment'),
                selected: this.selected,
                contacted: this.model.get('contacted')
            };

            _(viewModel.packages).each(function (package) {
                if (package.currentTask != null) {
                    console.log(package.packageId + ' current task is ' + package.currentTask);
                }
            });

            var template = _.template(_agentTemplate, viewModel);

            this.$el = $(template);
            $(target).append(this.$el);

            if (checked) {
                $('input[type=checkbox]', this.$el).attr('checked', 'checked');
            }

            return this;
        },
        unregister: function () {
            this.model.destroy();
        },
        manage: function (event) {
            var id = $(event.target).attr('data-id');
            manageAgentDialog.load(id);
        },
        viewLogs: function () {
            console.log("navigate to agent logs");
            app_router.navigate('logs/' + this.model.get('id'), {trigger: true});
            return true;
        }
    });

    var ManageAgentDialogView = Backbone.View.extend({
        tagName: 'div',
        id: 'manage-agent-dialog',
        events: {
            'click a.close-dialog': 'closeDialog',
            'submit form#apply-versions-form': 'startInstall',
            'click button.update-agent': 'startInstallSpecificPackage'
        },
        initialize: function () {
            _.bindAll(this, 'render');
            this.model = new Agent();
            this.$el.hide();
            $('body').append(this.$el);
        },
        load: function (hostname) {
            if (this.model) {
                console.log('load ' + hostname);
                this.model.id = hostname;
                this.model.fetch({ success: this.render });
            }
        },
        update: function() {
            this.model.fetch({ success: this.render });
            console.log('update dialog');
        },
        render: function () {
            console.log('render dialog');
            _manageAgentDialogOpen = true;
            var viewModel = {
                hostname: this.model.get('id'),
                packages: this.model.get('packages')
            };
            var dialogContent = _.template(_manageAgentDialogTemplate, viewModel);
            this.$el.html(dialogContent);
            this.$el.dialog({ autoOpen: false,
                height: 500,
                width: 600,
                modal: true,
                close: function () { _manageAgentDialogOpen = false;}
            });
            this.$el.dialog("open");
            this.delegateEvents();

        },
        closeDialog: function () {
            _manageAgentDialogOpen = false;
            this.$el.dialog("close");
        },
        startInstall: function () {
            var url = $('form', this.$el).attr('action');
            var data = '';
            var selectors = $('form select', this.$el);
            $(selectors).each(function (index, element) {
                if (data.length > 0) {
                    data += '&';
                }
                data += $(element).attr('name') + '=' + $(element).val();
            });
            $.post(url, data);

            return false;
        },
        startInstallSpecificPackage: function (event) {
            var packageId = $(event.target).attr('data-packageid');
            var selectedVersion = $('select[name="' + packageId + '"]', '#manage-agent').val();
            console.log('Update ' + packageId + ' to version ' + selectedVersion);

            var dataString = 'agents=' + this.model.get('id') + '&PackageId=' + packageId + '&Version=' + selectedVersion;

            var url = _apiBaseUrl + '/installation/start';

            $.post(url,
                dataString,
            function () { agentsListView.updateAll(); });
            
            return false;
        }
    });

    var UpdateToVersionView = Backbone.View.extend({
        tagName: 'div',
        id: 'update-agents',
        events: {
            'click button': 'updateAgents'
        },
        initialize: function () {
            _.bindAll(this, 'render', 'show', 'hide');
            this.versionCollection = new VersionList();
            this.versionCollection.fetch({add:true, success:this.render});
        },
        render: function () {
            var that = this;
            var selector = $('select[name=allVersions]', this.$el);
            var currentOptions = $('option', selector);

            var same = $(currentOptions).length == this.versionCollection.models.length;
            if (same) {
                $(currentOptions).each(function(option, index) {
                    same = option.val() == that.versionCollection.models[index].get('version');
                });
            }
            if (same) {
                return this;
            }

            var selectedValue = '';
            if (selector.length == 0) {
                selectedValue = selector.val();
            }
            var content = _.template(_updateAgentsTemplate, that.versionCollection);
            selector.val(selectedValue);
            this.$el.html(content);

            return this;
        },
        updateAgents: function () {
            var version = $('select[name=allVersions]').val();
            var selectedAgents = $('input:checked[type=checkbox][name="select-agent"]', agentsListView.$el);
            var hostnames = '';
            _(selectedAgents).each(function (input) {
                hostnames += '&agentHostnames=' + $(input).attr('data-value');
            });
            $.post('/api/agent/updateall',
                'version=' + version + hostnames,
            function () {
                agentsListView.collection.fetch({ success: function () { agentsListView.render(); } });
            });
        },
        show: function () {
            this.$el.show();
        },
        hide: function() {
            this.$el.hide();
        }
    });

    var AddAgentFormView = Backbone.View.extend({
        tagName: 'div',
        id: 'add-agent-form',
        events: {
            'click button#add': 'addAgent'
        },
        initialize: function () {
            _.bindAll(this, 'render', 'show', 'hide');
            _addAgentFormTemplate = "<input name='hostname' id='new-agent-hostname' type='textbox' /> <button id='add'>Add Agent</button>";
            this.render();
        },
        render: function () {
            
            var content = _.template(_addAgentFormTemplate);
            this.$el.html(content);
            return this;
        },
        addAgent: function () {
            var hostname = $('input[name=hostname]', this.$el).val();
            console.log('add agent ' + hostname);
            agentsListView.addAgent(hostname);
            $('input[name=hostname]', this.$el).val('');
        },
        show: function () {
            this.$el.show();
        },
        hide: function() {
            this.$el.hide();
        }
    });

    var AgentsListView = Backbone.View.extend({
        tagName: 'div',
        id: 'agent-list',
        events: {
            'click button#updateSelected': 'updateSelected'
        },

        initialize: function () {
            _.bindAll(this, 'render', 'add', 'remove');
            var self = this;

            this.hide();

            this.agentViews = [];
            
            this.collection = new AgentList();
            this.collection.bind('change', this.change);
            this.collection.bind('add', this.add);
            this.collection.bind('remove', this.remove);
            this.collection.bind('destroy', this.render);
            this.collection.fetch({ add: true, success: this.render });

            this.collection.each(function (agent) {
                self.agentViews.push(new AgentView({
                    model: agent,
                    tagName: 'li'
                }));
            });

        },
        add: function (agent) {
            var that = this;
            var dv = new AgentView({
                model: agent,
                tagName: 'li'
            });
            this.agentViews.push(dv);

            if (this._rendered) {
                $(this.el).append(dv.render().el);
            }
        },
        remove: function (agent) {
            var viewToRemove = _(this.agentViews).select(function (cv) { return cv.model === agent; })[0];
            this.agentViews = _(this.agentViews).without(viewToRemove);
            if (this._rendered) {
                $(viewToRemove.el).remove();
            }
        },
        change: function (agent) {
            console.log('listView.change()');
            var viewToUpdate = _(this.agentViews).select(function (cv) { return cv.model === agent; })[0];
            if (this._rendered) {
                viewToUpdate.render();
            }
        },

        render: function () {
            var self = this;
            this._rendered = true;

            var addHostnameValue = $('input[name=hostname]', this.$el).val();
            
            $(this.el).html(_appTemplate);
            $('input[name=hostname]', this.$el).val(addHostnameValue);


            _(this.collection.models).each(function (agent) {
                console.log('collection has agent ' + agent.id);
                console.log('with packages:');
                _(agent.get('packages')).each(function (package) {
                    console.log(package.packageId);
                    if (package.currentTask != null) {
                        console.log('current task ' + package.currentTask.lastMessage);
                    }
                });
            });

            _(this.agentViews).each(function (dv) {
                console.log('agentview render()');
                var agentId = dv.model.get("id");
                var matchingAgents = self.collection.where({ id: agentId });
                if (matchingAgents.length == 1) {
                    dv.model = matchingAgents[0];
                }
                dv.render($('ul', self.el));
                dv.delegateEvents();
            });
        },

        addAgent: function (hostname) {

            var item = new Agent();
            item.set({
                id: hostname
            });
            item.save();
            this.collection.add(item);
            this.render();
        },

        updateSelected: function () {
            var version = $('select[name=allVersions]').val();
            var selectedAgents = $('input:checked[type=checkbox][name="select-agent"]');
            var hostnames = '';
            _(selectedAgents).each(function (input) {
                hostnames += '&agentHostnames=' + $(input).attr('data-value');
            });
            $.post('/api/agent/updateall',
                'version=' + version + hostnames,
            function () {
                agentsListView.collection.fetch({ success: function () { agentsListView.render(); } });
            });
        },

        updateViews: function (item) {

            var agentView = this.agentViews[item.id];

            if (agentView) {
                agentView.model = item;
            }
            else {
                var agentView = new AgentView({
                    model: item,
                    selected: false
                });
                this.agentViews.push(agentView);
            }
        },
        updateAll: function () {
            this.collection.fetch({ success: agentsListView.render });
        },
        show: function () {
            this.$el.show();
        },
        hide: function() {
            this.$el.hide();
        }
    });
    
    agentsListView = new AgentsListView();
    addAgentFormView = new AddAgentFormView();
    updateAgentsToVersionView = new UpdateToVersionView();

    var manageAgentDialog = new ManageAgentDialogView();
    var logFoldersView = new AgentLogFolderCollectionView();
    var logFolderView = new AgentLogFolderView();
    var logFileView = new AgentLogFileView();

    
    var AppRouter = Backbone.Router.extend({
        routes: {
            "logs/:hostname/:packageId/:logFileName": "logFile",
            "logs/:hostname/:packageId": "logsForPackage",
            "logs/:hostname": "logsForAgent",
            "*actions": "defaultRoute" // matches http://example.com/#anything-here
        },
        defaultRoute: function( actions ){
            // The variable passed in matches the variable in the route definition "actions"
            console.log("default route");
            logFoldersView.hide();
            logFolderView.hide();
            logFileView.hide();
            
            agentsListView.show();
            addAgentFormView.show();
            updateAgentsToVersionView.show();
        },
        logsForPackage: function (hostname, packageId) {
            console.log("show logs for " + packageId + " on agent " + hostname);
            manageAgentDialog.closeDialog();
            agentsListView.hide();
            addAgentFormView.hide();
            updateAgentsToVersionView.hide();
            logFoldersView.hide();
            logFileView.hide();

            logFolderView.load(hostname, packageId);
            logFolderView.show();
        },
        logFile: function (hostname, packageId, logFileName) {
            console.log("show log " + packageId + "/" + logFileName + " on agent " + hostname);
            manageAgentDialog.closeDialog();
            agentsListView.hide();
            addAgentFormView.hide();
            updateAgentsToVersionView.hide();
            logFoldersView.hide();
            logFolderView.hide();

            logFileView.load(hostname, packageId, logFileName);
            logFileView.show();
        },
        logsForAgent: function (hostname) {
            console.log("show logs for agent " + hostname);
            manageAgentDialog.closeDialog();
            agentsListView.hide();
            addAgentFormView.hide();
            updateAgentsToVersionView.hide();
            logFolderView.hide();
            logFileView.hide();
            
            logFoldersView.load(hostname);
            logFoldersView.show();
            
        }
    });
    // Initiate the router
    var app_router = new AppRouter;
    // Start Backbone history a neccesary step for bookmarkable URL's
    Backbone.history.start();


    /*var updateLink = $('<a>update</a>').click(function() {
    listView.updateAll();
    });
    $('body').append(updateLink);*/
    

    setInterval(function () {
        agentsListView.updateAll();
        if (_manageAgentDialogOpen) {
            manageAgentDialog.update();
        }
    },
        _updateInterval);

})(jQuery);

$(document).ready(function () {
    _appTemplate = $('#app-template').html();
    _agentTemplate = $('#agent-row-template').html();
    _taskTemplate = $('#task-template').html();
    _packageTemplate = $('#package-template').html();
    _manageAgentDialogTemplate = $('#manage-agent-template').html();
    _updateAgentsTemplate = $('#update-agents-template').html();
    _logFileListTemplate = $('#log-file-list-template').html();
    _logFileTemplate = $('#log-file-template').html();
    _agentPackageLogFolderTemplate = $('#agent-log-packages-list-template').html();
    _addAgentFormTemplate = $('#add-agent-form-template').html();

    $('div#app').append(addAgentFormView.$el);
    $('div#app').append(updateAgentsToVersionView.$el);
    $('div#app').append(agentsListView.$el);
    
});