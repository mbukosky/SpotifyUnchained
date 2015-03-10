# [Spotify Unchained](http://www.spotifyunchained.com)

[![Build Status](https://travis-ci.org/mbukosky/SpotifyUnchained.svg)](https://travis-ci.org/mbukosky/SpotifyUnchained)
[![Dependencies Status](https://david-dm.org/mbukosky/SpotifyUnchained.svg)](https://david-dm.org/mbukosky/SpotifyUnchained)

Never lose a playlist again. This website was specially designed to replace a running Spotify [form](https://community.spotify.com/t5/Music-Chat/New-Music-Tuesday-Archive/m-p/1037048#M20850). I am a developer, Spotify user, and here is my solution.

## Website
 [spotifyunchained.com](https://spotifyunchained.com)

## Prerequisites
Make sure you have installed all these prerequisites on your development machine.
* Node.js - [Download & Install Node.js](http://www.nodejs.org/download/) and the npm package manager, if you encounter any problems, you can also use this [GitHub Gist](https://gist.github.com/isaacs/579814) to install Node.js.
* MongoDB - [Download & Install MongoDB](http://www.mongodb.org/downloads), and make sure it's running on the default port (27017).
* Bower - You're going to use the [Bower Package Manager](http://bower.io/) to manage your front-end packages, in order to install it make sure you've installed Node.js and npm, then install bower globally using npm:

```
$ npm install -g bower
```

* Grunt - You're going to use the [Grunt Task Runner](http://gruntjs.com/) to automate your development process, in order to install it make sure you've installed Node.js and npm, then install grunt globally using npm:

```
$ sudo npm install -g grunt-cli
```

## Quick Install

To install Node.js dependencies you're going to use npm again, in the application folder run this in the command-line:

```
$ npm install
```

This command does a few things:
* First it will install the dependencies needed for the application to run.
* If you're running in a development environment, it will then also install development dependencies needed for testing and running your application.
* Finally, when the install process is over, npm will initiate a bower install command to install all the front-end modules needed for the application

## Running Your Application
After the install process is over, you'll be able to run your application using Grunt, just run grunt default task:

```
$ grunt
```

Your application should run on the 3000 port so in your browser just go to [http://localhost:3000](http://localhost:3000)

That's it! your application should be running by now, to proceed with your development check the other sections in this documentation.
If you encounter any problem try the Troubleshooting section.

## Community
* The [original](https://community.spotify.com/t5/Music-Chat/New-Music-Tuesday-Archive/m-p/1037048#M20850) Spotify form
* Create a new issue if you want additional features or playlists added

## Credits
* [MEAN.JS](http://meanjs.org)

## License
(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
