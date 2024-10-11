// webpack.config.js

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const StringReplacePlugin = require("string-replace-webpack-plugin");
const I18nPlugin = require('@zainulbr/i18n-webpack-plugin');
const crypto = require("crypto");
const webpack = require('webpack');
const crypto_orig_createHash = crypto.createHash;
crypto.createHash = algorithm => crypto_orig_createHash(algorithm == "md4" ? "sha256" : algorithm);
const TerserPlugin = require('terser-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const Dotenv = require('dotenv-webpack'); // Importer dotenv-webpack
const isProduction = process.env.NODE_ENV === 'production';

const babelConf = {
    loader: 'babel-loader',
    options: {
        presets: [
            ['@babel/preset-env', { targets: "defaults" }]
        ]
    }
};

const locale = {
    en: require('./locales/en.json'),
    fr: require('./locales/fr.json')
};

const defaultLocale = 'fr';

function pageUrl(lang, pageRel) {
    if(lang === defaultLocale) {
        return pageRel;
    } else {
        return lang + '/' + pageRel;
    }
}

function langToLocale(lang) {
    if(lang === 'fr')
        return 'fr-FR'
    else if(lang === 'en')
        return 'en-US'
    else
        return null;
}

function urlGenerator(lang, page) {
    return ('https://arbre.app/' + pageUrl(lang, page)).replace(/\/$/, "");
}

module.exports = Object.keys(locale).map(lang => {
    const globals = {
        lang: lang,
        locale: langToLocale(lang),
        urlGenerator: page => urlGenerator(lang, page),
        urlGeneratorLang: urlGenerator
    };

    return {
        // mode: 'development',
        name: 'config',
        devtool: 'source-map',
        entry: {
            home: './assets/geneafan.js',
            geneafan: './assets/geneafan.js',
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: './js/[name].bundle.[contenthash].js',
            globalObject: 'self'
        },
        stats: {
            errorDetails: true
        },
        optimization: {
            splitChunks: {
                cacheGroups: {
                    vendors: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        chunks: 'all'
                    },
                    commons: {
                        name: 'commons',
                        chunks: 'all',
                        minChunks: 2,
                        priority: 20,
                        reuseExistingChunk: true,
                        enforce: true
                    }
                },
                minSize: 10000,
                maxSize: 0,
            },
            minimize: true,
            minimizer: [new TerserPlugin()],
        },
        performance: {
            hints: 'warning',
            maxAssetSize: 200000,
            maxEntrypointSize: 400000,
        },
        resolve: {
            fallback: {
                'stream': require.resolve('stream-browserify'),
                'zlib': require.resolve('browserify-zlib'),
                'util': require.resolve('util/'),
                'crypto': require.resolve('crypto-browserify'),
                'buffer': require.resolve('buffer'),
                "path": require.resolve("path-browserify"),
                "os": require.resolve("os-browserify/browser"),
            },
            alias: {
                fs: 'pdfkit/js/virtual-fs.js',
                'process/browser': 'process/browser.js'
            }
        },
        stats: {
            children: true,
        },
        module: {
            rules: [
                // Vos règles existantes
                {
                    enforce: 'pre',
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: babelConf
                },
                {
                    test: /\.js$/,
                    include: /(pdfkit|saslprep|unicode-trie|unicode-properties|dfa|linebreak|panzoom)/,
                    use: babelConf
                },
                {
                    test: /\.mjs$/,
                    include: /node_modules/,
                    type: 'javascript/auto',
                    use: babelConf
                },
                {
                    test: /\.js$/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env'],
                        },
                    },
                },
                {
                    enforce: 'post',
                    test: /fontkit[/\\]index.js$/,
                    use: {
                        loader: "transform-loader?brfs"
                    }
                },
                {
                    enforce: 'post',
                    test: /unicode-properties[/\\]index.js$/,
                    use: {
                        loader: "transform-loader?brfs"
                    }
                },
                {
                    enforce: 'post',
                    test: /linebreak[/\\]src[/\\]linebreaker.js/,
                    use: {
                        loader: "transform-loader?brfs"
                    }
                },
                {test: /src[/\\]assets/, loader: 'arraybuffer-loader'},
                {test: /\.afm$/, loader: 'raw-loader'},

                {
                    test: /\.(html)$/,
                    loader: 'html-loader',
                    options: {
                        interpolate: true,
                        minimize: false,
                    },
                    exclude: /node_modules/,
                },
                {
                    test: /\.(css|sass|scss)$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        'css-loader',
                        'resolve-url-loader',
                        'postcss-loader',
                        'sass-loader'
                    ],
                    exclude: /node_modules/,
                },

                {
                    test: /\.(jpe?g|png|gif|svg)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                outputPath: (url, resourcePath, context) => {
                                    return `images/${url}`;
                                },
                                name: '[name].[ext]',
                            },
                        },
                        {
                            loader: 'image-webpack-loader',
                            options: {
                                disable: process.env.NODE_ENV !== 'production',
                                mozjpeg: {
                                    progressive: true,
                                    quality: 75
                                },
                            },
                        }
                    ],
                },
                {
                    type: 'javascript/auto',
                    test: /(favicon\.ico|site\.webmanifest|manifest\.json|browserconfig\.xml|robots\.txt|humans\.txt)$/,
                    loader: 'file-loader',
                    options: {
                        name: '[name].[ext]',
                    },
                    exclude: /node_modules/,
                },
                {
                    test: /\.(woff(2)?|ttf|eot)(\?[a-z0-9=.]+)?$/,
                    loader: 'file-loader',
                    options: {
                        outputPath: 'fonts',
                        name: '[name].[ext]',
                    },
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/,
                    include: /node_modules/,
                    use: [
                        'style-loader',
                        'css-loader'
                    ]
                },
                {
                    test: /\.js$/,
                    use: {
                        loader: StringReplacePlugin.replace({
                            replacements: [
                                {
                                    pattern: /trimLeft\(\)/ig,
                                    replacement: function (match, p1, offset, string) {
                                        return 'trim()';
                                    }
                                }
                            ]
                        })
                    }
                }
            ],
        },
        plugins: [
            // Charger les variables d'environnement
            new Dotenv({
                path: isProduction ? './.env.production' : './.env.development',
                safe: false, // Si vous utilisez un fichier .env.example pour valider les variables
            }),
            new HtmlWebpackPlugin({
                template: './assets/html/index.ejs',
                templateParameters: globals,
                filename: pageUrl(lang, 'index.html'),
                chunks: ['geneafan', 'commons', 'i18n'],
                hash: true,
            }),
            new MiniCssExtractPlugin({
                filename: './css/[name].css'
            }),
            new WebpackManifestPlugin({
                fileName: 'asset-manifest.json',
                publicPath: 'dist/'
            }),
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            }),
            new webpack.DefinePlugin({
                'process.env': JSON.stringify(process.env), // Injecter les variables d'environnement
            }),
            new StringReplacePlugin(),
            new I18nPlugin(locale[lang], {nested: true}),
            new webpack.ProvidePlugin({
                process: 'process/browser',
            }),
        ]
    }
});
