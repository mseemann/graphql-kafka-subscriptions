"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var Kafka = require("node-rdkafka");
var Logger = require("bunyan");
var child_logger_1 = require("./child-logger");
var pubsub_async_iterator_1 = require("./pubsub-async-iterator");
var defaultLogger = Logger.createLogger({
    name: 'pubsub',
    stream: process.stdout,
    level: 'info'
});
var KafkaPubSub = (function () {
    function KafkaPubSub(options) {
        this.options = options;
        this.subscriptionMap = {};
        this.channelSubscriptions = {};
        this.consumer = this.createConsumer(this.options.topic);
        this.logger = child_logger_1.createChildLogger(this.options.logger || defaultLogger, 'KafkaPubSub');
    }
    KafkaPubSub.prototype.publish = function (payload) {
        this.producer = this.producer || this.createProducer(this.options.topic);
        return this.producer.write(new Buffer(JSON.stringify(payload)));
    };
    KafkaPubSub.prototype.subscribe = function (channel, onMessage, options) {
        var index = Object.keys(this.subscriptionMap).length;
        this.subscriptionMap[index] = [channel, onMessage];
        this.channelSubscriptions[channel] = __spreadArrays((this.channelSubscriptions[channel] || []), [
            index
        ]);
        return Promise.resolve(index);
    };
    KafkaPubSub.prototype.unsubscribe = function (index) {
        var channel = this.subscriptionMap[index][0];
        this.channelSubscriptions[channel] = this.channelSubscriptions[channel].filter(function (subId) { return subId !== index; });
    };
    KafkaPubSub.prototype.asyncIterator = function (triggers) {
        return new pubsub_async_iterator_1.PubSubAsyncIterator(this, triggers);
    };
    KafkaPubSub.prototype.onMessage = function (channel, message) {
        var subscriptions = this.channelSubscriptions[channel];
        if (!subscriptions) {
            return;
        }
        for (var _i = 0, subscriptions_1 = subscriptions; _i < subscriptions_1.length; _i++) {
            var subId = subscriptions_1[_i];
            var _a = this.subscriptionMap[subId], cnl = _a[0], listener = _a[1];
            listener(message);
        }
    };
    KafkaPubSub.prototype.brokerList = function () {
        return this.options.port ? this.options.host + ":" + this.options.port : this.options.host;
    };
    KafkaPubSub.prototype.createProducer = function (topic) {
        var _this = this;
        var producer = Kafka.createWriteStream(Object.assign({}, { 'metadata.broker.list': this.brokerList() }, this.options.globalConfig), {}, { topic: topic });
        producer.on('error', function (err) {
            _this.logger.error(err, 'Error in our kafka stream');
        });
        return producer;
    };
    KafkaPubSub.prototype.createConsumer = function (topic) {
        var _this = this;
        var groupId = this.options.groupId || Math.ceil(Math.random() * 9999);
        var stream = Kafka.createReadStream(Object.assign({}, {
            'group.id': "kafka-group-" + groupId,
            'metadata.broker.list': this.brokerList(),
        }, this.options.globalConfig), {}, { topics: [topic] });
        stream.consumer.on('data', function (message) {
            var parsedMessage = JSON.parse(message.value.toString());
            if (parsedMessage.channel) {
                var channel = parsedMessage.channel, payload = __rest(parsedMessage, ["channel"]);
                _this.onMessage(parsedMessage.channel, payload);
            }
            else {
                _this.onMessage(topic, parsedMessage);
            }
        });
        return stream;
    };
    return KafkaPubSub;
}());
exports.KafkaPubSub = KafkaPubSub;
//# sourceMappingURL=kafka-pubsub.js.map