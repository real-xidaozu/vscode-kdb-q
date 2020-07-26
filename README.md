# vscode-kdb-q

This [Visual Studio Code](https://code.visualstudio.com/) extension provides extensive features for the [kdb+/q](https://code.kx.com/q/) programming language.
Features include syntax highlighting, auto completion, executing queries on a kdb+ server, table visualization and more.
The extension is developed with Atom's [connect-kdb-q](https://github.com/quintanar401/connect-kdb-q) extension and [QInsightPad](http://www.qinsightpad.com/) in mind.
Although any theme will work, the recommended theme is [Atom One Dark](https://marketplace.visualstudio.com/items?itemName=akamud.vscode-theme-onedark) for the best experience.

Please note that the extension is usable in its current state, but is still under development.

## Features

The extension currently provides the following features:

* Accurate syntax highlighting
* Reliable code completion (based on remote server process)
* Running kdb+ queries and output the result in a console
* Show table results in a high performance grid view
* Explorer view exposing all functions and variables

## Demonstration 

![Demo](https://github.com/real-xidaozu/vscode-kdb-q/blob/master/resources/static/vscode-kdb-q-demo.gif?raw=true)

## Requirements

None in particular, although kdb+ 3.6 or higher is recommended.

## Extension Settings

Settings will be added in the near future.

## Known Issues

Below is a list of known issues and incomplete features:

* Console output from query results can be shown slightly different
* The explorer view is initialized only once upon connection
* Code completion is not supported when not connected to a kdb+ server
* Nested objects and functions are not printed to console

## License

Licensed under GNU General Public License v3.0.
See the license file for more details.

## Release Notes

### 1.0.0

Initial release of vscode-kdb-q.
