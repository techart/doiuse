let _ = require('lodash');
let missingSupport = require('./missing-support');
let Detector = require('./detect-feature-use');
let Multimatch = require('multimatch');

function doiuse(options) {
	let {browsers: browserQuery, onFeatureUsage, ignore: ignoreOptions, ignoreFiles} = options;

	if (!browserQuery) {
		browserQuery = doiuse['default'].slice()
	}

	if (!onFeatureUsage) {
		onFeatureUsage = function onlyMissingSupport(usageInfo) {
			return usageInfo.featureData.missing;
		};
	}

	let {browsers, features} = missingSupport(browserQuery);
	let detector = new Detector(_.keys(features));

	return {
		info () {
			return {
				browsers: browsers,
				features: features
			}
		},

		postcss (css, result) {
			return detector.process(css, function ({feature, usage, ignore}) {
				if (ignore && ignore.indexOf(feature) !== -1) {
					return;
				}

				if (ignoreOptions && ignoreOptions.indexOf(feature) !== -1) {
					return;
				}

				let loc = usage.source;
				loc.original = css.source.input.map ? {
					start: css.source.input.map.consumer().originalPositionFor(loc.start),
					end: css.source.input.map.consumer().originalPositionFor(loc.end)
				} : {
					start: loc.start,
					end: loc.end
				};

				let filepath = (loc.original.start.source || loc.input.file || loc.input.from);

				if (ignoreFiles && Multimatch(filepath, ignoreFiles).length > 0) {
					return;
				}

				let messages = [];
				if (features[feature].missing) {
					messages.push('not supported by: ' + features[feature].missing)
				}
				if (features[feature].partial) {
					messages.push('only partially supported by: ' + features[feature].partial)
				}

				let message = features[feature].title + ' ' + messages.join(' and ') + ' (' + feature + ')';

				let warn = function resultWarn() {
					result.warn(message, {node: usage, plugin: 'doiuse'});
				};

				if (onFeatureUsage) {

					message = filepath + ':' + loc.original.start.line + ':' + loc.original.start.column + ': ' + message;

					if (onFeatureUsage({
							feature: feature,
							featureData: features[feature],
							usage: usage,
							message: message
						})) {
						warn();
					}
				} else {
					warn();
				}
			})
		}
	}
}
doiuse['default'] = [
	'> 1%',
	'last 2 versions',
	'Firefox ESR',
	'Opera 12.1'
]
module.exports = doiuse
