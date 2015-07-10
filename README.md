# [Unchaining Spotify](https://spotifyunchained.com)

[![Build Status](https://travis-ci.org/mbukosky/SpotifyUnchained.svg)](https://travis-ci.org/mbukosky/SpotifyUnchained)
[![Dependencies Status](https://david-dm.org/mbukosky/SpotifyUnchained.svg)](https://david-dm.org/mbukosky/SpotifyUnchained)

Never lose a playlist again. A simple site that automatically archives [new music tuesday](https://open.spotify.com/user/spotify/playlist/1yHZ5C3penaxRdWR7LRIOb) playlist before it refreshes. This website was specially designed to replace a running Spotify [form](https://community.spotify.com/t5/Music-Chat/New-Music-Tuesday-Archive/m-p/1037048#M20850).

This is not an official Spotify application. I am a developer, Spotify user, and here is my solution.

## Social
* [spotifyunchained.com](https://spotifyunchained.com)
* [@SpotifyUnchnd](https://twitter.com/SpotifyUnchnd)
* [/spotifyunchained](https://www.facebook.com/spotifyunchained)
* SpotifyUnchained@gmail.com

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
* Tweet me [@SpotifyUnchnd](https://twitter.com/SpotifyUnchnd)

## Credits
* [MEAN.JS](http://meanjs.org)
* [angular-spotify](https://github.com/eddiemoore/angular-spotify)
* [angular-remote-logger](https://github.com/inakianduaga/angular-remote-logger)

## License
(MIT)
