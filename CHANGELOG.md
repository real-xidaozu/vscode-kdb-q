# Change Log

## 1.2.0

* Added support for printing dictionaries and keyed tables
* Added icon to status bar to indicate connection status
* Added auto (re)connect upon query
* Several bug fixes regarding query results
* Usability and interface improvements

## 1.1.2

* Minor fixes to grid view, and nested object formatting

## 1.1.1

* Added server view (configurable through settings.json)
* Minor fixes to how result views are handled

## 1.1.0

New features:

* Syntax highlighted document view for query results
* Extension settings for enabled panels and their positions
* Click items from kdb+ explorer to see their contents
* Default keybindings (Ctrl+Q for connect, Ctrl+E/Ctrl+Enter for running queries)
* Support for filtering dates and numbers in grid view
* Connection status bar item is now clickable to connect
* Nanosecond precision for timespans (up from milliseconds)
* Microsecond precision for timestamps (up from milliseconds)

Bug fixes:

* Fixed auto completion not working in some cases
* Fixed printing of empty tables
* Fixed variables in global namespace in kdb+ explorer

## 1.0.0

Initial release of vscode-kdb-q, featuring:

* Accurate syntax highlighting
* Reliable code completion (based on remote server process)
* Running kdb+ queries and output the result in a console
* Show table results in a high performance grid view
* Explorer view exposing all functions and variables