define("plugins/sourcegraph/package.sourcegraph", [], {
    "name": "sourcegraph",
    "version": "0.0.1",
    "author": "Sourcegraph",
    "contributors": [
        {
            "name": "Matt King",
            "email": "king@sourcegraph.com"
        }
    ],
    "repository": {
        "type": "git",
        "url": ""
    },
    "categories": [
        "miscellaneous"
    ],
    "licenses": [],
    "c9": {
        "plugins": [
            {
                "packagePath": "plugins/sourcegraph/sourcegraph"
            }
        ]
    }
});

define("plugins/sourcegraph/sourcegraph",[], function(require, exports, module) {
  main.consumes = [
    'Plugin',
    'commands',
    'settings',
    'preferences',
    'proc',
    'c9',
    'tabManager'
  ]
  main.provides = ['sourcegraph']
  return main

  function main(options, imports, register) {
    var Plugin = imports.Plugin
    var commands = imports.commands
    var settings = imports.settings
    var prefs = imports.preferences
    var proc = imports.proc
    var workspaceDir = imports.c9.workspaceDir
    var tabs = imports.tabManager
    var VERSION = '0.0.1'

    var plugin = new Plugin('Ajax.org', main.consumes)
    var emit = plugin.getEmitter()

    function load() {
      addCommands()
      addPrefs()
      readSettings()
    }

    function addPrefs() {
      prefs.add(
        {
          General: {
            position: 450,
            'Sourcegraph Server': {
              position: 100,
              URL: {
                type: 'textbox',
                setting: 'user/sourcegraph/@sourcegraph_url',
                position: 100
              }
            }
          }
        },
        plugin
      )
    }

    function readSettings() {
      settings.on(
        'read',
        function() {
          settings.setDefaults('user/sourcegraph', [
            ['sourcegraph_url', 'https://sourcegraph.com']
          ])
        },
        plugin
      )
    }

    function addCommands() {
      commands.addCommand(
        {
          name: 'sourcegraph_open',
          bindKey: {
            mac: 'Option-O',
            win: 'Alt-O'
          },
          exec: function() {
            repoInfo(function(info) {
              var tab = tabs.focussedTab
              var selection = tab.editor.ace.getSelectionRange()
              var { anchor, cursor } = getRangeForSelection(selection)

              var startRow = anchor.row
              var startCol = anchor.column
              var endRow = cursor.row
              var endCol = cursor.column
              var sourcegraphUrl =
                settings.get('user/sourcegraph/@sourcegraph_url') ||
                'https://sourcegraph.com'
              var url = `${sourcegraphUrl.replace(
                /\/+$/,
                ''
              )}/-/editor?remote_url=${encodeURIComponent(
                info.remote
              )}&branch=${encodeURIComponent(
                info.branch
              )}&file=${encodeURIComponent(
                info.file
              )}&editor=${encodeURIComponent(
                'Cloud9'
              )}&version=${VERSION}&start_row=${startRow}&start_col=${startCol}&end_row=${endRow}&end_col=${endCol}`
              window.open(url, '_blank')
            })
          },
          isAvailable: function(editor) {
            if (editor && editor.ace) {
              return true
            }
          }
        },
        plugin
      )

      commands.addCommand(
        {
          name: 'sourcegraph_search',
          bindKey: {
            mac: 'Option-S',
            win: 'Alt-S'
          },
          exec: function() {
            repoInfo(function(info) {
              var sourcegraphUrl =
                settings.get('user/sourcegraph/@sourcegraph_url') ||
                'https://sourcegraph.com'
              var tab = tabs.focussedTab
              var editor = tab.editor.ace
              var query = editor.session.getTextRange(
                editor.getSelectionRange()
              )
              var url = `${sourcegraphUrl.replace(
                /\/+$/,
                ''
              )}/-/editor?remote_url=${encodeURIComponent(
                info.remote
              )}&branch=${encodeURIComponent(
                info.branch
              )}&file=${encodeURIComponent(
                info.file
              )}&editor=${encodeURIComponent(
                'Cloud9'
              )}&version=${VERSION}&start_row=${
                info.startRow
              }&search=${encodeURIComponent(query)}`
              window.open(url, '_blank')
            })
          },
          isAvailable: function(editor) {
            if (editor && editor.ace) return !editor.ace.selection.isEmpty()
            return false
          }
        },
        plugin
      )
    }

    function repoInfo(callback) {
      getRemote(function(err, remotes) {
        if (err) {
          return
        }
        var remote = remotes[0]
        gitRemoteUrl(remote, function(err, remoteUrl) {
          if (err) {
            return
          }
          getBranch(function(err, branch) {
            if (err) {
              return
            }
            var tab = tabs.focussedTab
            var filePath = tab && tab.path
            callback({
              remote: remoteUrl,
              branch: branch,
              file: filePath
            })
          })
        })
      })
    }

    function buffer(process, callback) {
      var stdout = ''
      var stderr = ''
      process.stdout.on('data', function(c) {
        stdout += c
      })
      process.stderr.on('data', function(c) {
        stderr += c
      })
      process.on('exit', function(c) {
        callback(stdout, stderr)
      })
    }

    function git(args, callback) {
      if (typeof args == 'string') args = args.split(/\s+/)

      proc.spawn(
        'git',
        {
          args: args,
          cwd: workspaceDir
        },
        function(e, p) {
          buffer(p, function(stdout, stderr) {
            callback && callback(e, stdout, stderr)
          })
        }
      )
    }

    function getBranch(callback) {
      git(['rev-parse', '--abbrev-ref', 'HEAD'], function(err, stdout, stderr) {
        if (err || stderr) return callback(err || stderr)
        callback(null, stdout.trim())
      })
    }

    function getRemote(callback) {
      git(['remote'], function(err, stdout, stderr) {
        if (err || stderr) return callback(err || stderr)
        callback(null, stdout.split('\n'))
      })
    }

    function gitRemoteUrl(remoteName, callback) {
      return git(['remote', 'get-url', remoteName], function(
        err,
        stdout,
        stderr
      ) {
        if (err || stderr) return callback(err || stderr)
        callback(null, stdout.trim())
      })
    }

    function getRangeForSelection(selection) {
      var cursor
      var anchor
      if (selection.start.row === selection.end.row) {
        if (selection.start.column < selection.end.column) {
          anchor = selection.start
          cursor = selection.end
        } else {
          anchor = selection.end
          cursor = selection.start
        }
      } else if (selection.start.row < selection.end.row) {
        anchor = selection.start
        cursor = selection.end
      } else {
        anchor = selection.end
        cursor = selection.start
      }
      return { cursor, anchor }
    }

    plugin.on('load', function() {
      load()
    })
    plugin.on('unload', function() {})

    plugin.freezePublicAPI({})

    register(null, {
      sourcegraph: plugin
    })
  }
})
