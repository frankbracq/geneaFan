const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const StringReplacePlugin = require("string-replace-webpack-plugin");
const I18nPlugin = require('@zainulbr/i18n-webpack-plugin');
const crypto = require("crypto");
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const Dotenv = require('dotenv-webpack');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const crypto_orig_createHash = crypto.createHash;
crypto.createHash = algorithm => crypto_orig_createHash(algorithm === "md4" ? "sha256" : algorithm);

const locale = {
    en: require('./locales/en.json'),
    fr: require('./locales/fr.json')
};

const defaultLocale = 'fr';

function pageUrl(lang, pageRel) {
    return lang === defaultLocale ? pageRel : `${lang}/${pageRel}`;
}

function langToLocale(lang) {
    return lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : null;
}

function urlGenerator(lang, page) {
    return `https://arbre.app/${pageUrl(lang, page)}`.replace(/\/$/, "");
}

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    const babelConf = {
        loader: 'babel-loader',
        options: {
            presets: [
                ['@babel/preset-env', { targets: "defaults" }]
            ],
            compact: false,
            plugins: [
                // Suppression des console.log en production
                ...(isProduction ? ['transform-remove-console'] : []),
            ],
        }
    };

    return Object.keys(locale).map(lang => {
        const globals = {
            lang: lang,
            locale: langToLocale(lang),
            urlGenerator: page => urlGenerator(lang, page),
            urlGeneratorLang: urlGenerator
        };

        return {
            name: 'config',
            devtool: isProduction ? false : 'eval-source-map', // Désactiver les source maps en production
            entry: {
                geneafan: './assets/geneafan.js',
            },
            output: {
                path: path.resolve(__dirname, 'dist'),
                filename: './js/[name].bundle.[contenthash].js',
                globalObject: 'self'
            },
            stats: {
                errorDetails: true,
                children: true,
            },
            optimization: {
                splitChunks: {
                    chunks: 'all',
                    minSize: 20000,
                    maxSize: 200000,
                    cacheGroups: {
                        vendors: {
                            test: /[\\/]node_modules[\\/]/,
                            name: 'vendors',
                            chunks: 'all',
                            priority: -10,
                            reuseExistingChunk: true,
                        },
                        commons: {
                            name: 'commons',
                            minChunks: 2,
                            priority: 10,
                            reuseExistingChunk: true,
                            enforce: true,
                        },
                        default: false, // Désactiver le groupe par défaut pour éviter les conflits
                    },
                },
                minimize: isProduction,
                minimizer: [
                    new TerserPlugin({
                        terserOptions: {
                            compress: {
                                drop_console: isProduction,
                            },
                        },
                        parallel: true, // Utiliser le parallélisme pour accélérer la minification
                    }),
                    new CssMinimizerPlugin(),
                ],
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
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: /node_modules\/(lodash|@clerk\/clerk-js|fontkit)/,
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
                    { test: /src[/\\]assets/, loader: 'arraybuffer-loader' },
                    { test: /\.afm$/, loader: 'raw-loader' },
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
                                    outputPath: (url, resourcePath, context) => `images/${url}`,
                                    name: '[name].[ext]',
                                },
                            },
                            {
                                loader: 'image-webpack-loader',
                                options: {
                                    disable: !isProduction, // Utiliser isProduction ici
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
                                        replacement: () => 'trim()'
                                    }
                                ]
                            })
                        }
                    }
                ],
            },
            plugins: [
                new webpack.ProgressPlugin(), // Barre de progression
                new Dotenv({
                    path: isProduction ? './.env.production' : './.env.development',
                    safe: false,
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
                    'process.env.NODE_ENV': JSON.stringify(argv.mode),
                }),
                new StringReplacePlugin(),
                new I18nPlugin(locale[lang], { nested: true }),
                new webpack.ProvidePlugin({
                    process: 'process/browser',
                }),
                ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []),
            ]
        };
    });
};