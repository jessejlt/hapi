// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Hapi = require(libPath + 'hapi');
var NodeUtil = require('util');
var Stream = require('stream');
var Request = require('request');


describe('Response', function () {

    var server = new Hapi.Server('0.0.0.0', 17082);

    var textHandler = function (request) {

        request.reply.payload('text').type('text/plain').bytes(4).send();
    };

    var errorHandler = function (request) {

        request.reply.payload(new Error('boom')).send();
    };

    var emptyHandler = function (request) {

        request.reply();
    };

    var baseHandler = function (request) {

        request.reply(new Hapi.Response.Text('hola'));
    };

    var fileHandler = function(request) {

        var file = new Hapi.Response.File(__dirname + '/../../package.json');
        request.reply(file);
    };

    var fileNotFoundHandler = function(request) {

        var file = new Hapi.Response.File(__dirname + '/../../notHere');
        request.reply(file);
    };

    var expHandler = function (request) {

        Hapi.Response._respond(null, request, function () { });
    };


    FakeStream = function (issue) {

        Stream.call(this);
        this.pause = this.resume = this.setEncoding = function () { };
        this.issue = issue;
        return this;
    };

    NodeUtil.inherits(FakeStream, Stream);


    FakeStream.prototype.on = FakeStream.prototype.addListener = function (event, callback) {

        switch (this.issue) {
            case 'error':
                if (event === 'error') {
                    if (!this.x) {
                        callback();
                        this.x = true;
                    }
                }
                break;

            case 'double':
                if (event === 'data') {
                    callback('x');
                    this.x();
                    this.y();
                }
                else if (event === 'error') {
                    if (!this.x) {
                        this.x = callback;
                    }
                }
                else if (event === 'end') {
                    if (!this.y) {
                        this.y = callback;
                    }
                }
            break;

            default:
                if (event === 'data') {
                    callback('x');
                    this.x();
                }
                else if (event === 'end') {
                    this.x = callback;
                }
                break;
        }
    };

    var streamHandler = function (request) {

        request.reply.stream(new FakeStream(request.params.issue)).bytes(request.params.issue ? 0 : 1).send();
    };

    server.addRoutes([
        { method: 'POST', path: '/text', handler: textHandler },
        { method: 'POST', path: '/error', handler: errorHandler },
        { method: 'POST', path: '/empty', handler: emptyHandler },
        { method: 'POST', path: '/base', handler: baseHandler },
        { method: 'POST', path: '/exp', handler: expHandler },
        { method: 'POST', path: '/stream/{issue?}', handler: streamHandler },
        { method: 'POST', path: '/file', handler: fileHandler },
        { method: 'POST', path: '/filenotfound', handler: fileNotFoundHandler }
    ]);

    it('returns a text reply', function (done) {

        var request = { method: 'POST', url: '/text' };

        server.inject(request, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.equal('text');
            done();
        });
    });

    it('returns an error reply', function (done) {

        var request = { method: 'POST', url: '/error' };

        server.inject(request, function (res) {

            expect(res.statusCode).to.equal(500);
            expect(res.result).to.exist;
            expect(res.result.message).to.equal('boom');
            done();
        });
    });

    it('returns an empty reply', function (done) {

        var request = { method: 'POST', url: '/empty' };

        server.inject(request, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.equal('');
            done();
        });
    });

    it('returns a base reply', function (done) {

        var request = { method: 'POST', url: '/base' };

        server.inject(request, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.equal('hola');
            done();
        });
    });

    it('returns an error reply on invalid Response._respond', function (done) {

        var request = { method: 'POST', url: '/exp' };

        server.inject(request, function (res) {

            expect(res.statusCode).to.equal(500);
            expect(res.result).to.exist;
            expect(res.result.message).to.equal('An internal server error occurred');
            done();
        });
    });

    it('returns a stream reply', function (done) {

        var request = { method: 'POST', url: '/stream' };

        server.inject(request, function (res) {

            expect(res.readPayload()).to.equal('x');
            done();
        });
    });

    it('returns a broken stream reply on error issue', function (done) {

        var request = { method: 'POST', url: '/stream/error' };

        server.inject(request, function (res) {

            expect(res.readPayload()).to.equal('');
            done();
        });
    });

    it('returns a broken stream reply on double issue', function (done) {

        var request = { method: 'POST', url: '/stream/double' };

        server.inject(request, function (res) {

            expect(res.readPayload()).to.equal('x');
            done();
        });
    });

    describe('#file', function() {

        it('returns a file in the response with the correct headers', function (done) {

            server.start(function() {

                Request.post('http://localhost:17082/file', function(err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('hapi');
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-length']).to.exist;
                    done();
                });
            });
        });

        it('returns a 404 when the file is not found', function (done) {

            server.start(function() {

                Request.post('http://localhost:17082/filenotfound', function(err, res) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });
    });

});