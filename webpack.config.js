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
const os = require('os');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

// Workaround for MD4 algorithm used by Webpack in crypto hashing
const crypto_orig_createHash = crypto.createHash;
crypto.createHash = algorithm => crypto_orig_createHash(algorithm === "md4" ? "sha256" : algorithm);

// Load language files for localization
const locale = {
    en: require('./locales/en.json'),
    fr: require('./locales/fr.json')
};

const defaultLocale = 'fr';

// Function to generate a page URL based on the selected language
function pageUrl(lang, pageRel) {
    return lang === defaultLocale ? pageRel : `${lang}/${pageRel}`;
}

// Function to generate the full URL for a page
function urlGenerator(lang, page) {
    return `https://genealogie.app/${pageUrl(lang, page)}`.replace(/\/$/, "");
}

// Function to map language to locale format
function langToLocale(lang) {
    return lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : null;
}

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    
    // Chargez dotenv ici, avec accès à argv
    require('dotenv').config({
        path: isProduction ? './.env.production' : './.env.development'
    });
    
    // Récupérez la variable d'environnement après avoir chargé dotenv
    const removeConsole = process.env.REMOVE_CONSOLE === 'true';
    
    if (!isProduction) {
        process.env.WEBPACK_DEV_SERVER = true;
        require('webpack').performance = { hints: false };
    }
    
    // Configuration pour esbuild-loader (plus rapide que babel-loader)
    const esbuildConf = {
        loader: 'esbuild-loader',
        options: {
            target: 'es2015',
            drop: removeConsole ? ['console'] : [],
        }
    };
    
    // Garde babel-loader comme fallback si nécessaire pour des plugins spécifiques
    const babelConf = {
        loader: 'babel-loader',
        options: {
            presets: [
                ['@babel/preset-env', { targets: "defaults" }]
            ],
            compact: false,
            plugins: [
                ...(removeConsole ? ['transform-remove-console'] : []),
            ],
        }
    };

    // Déterminer le nombre optimal de workers pour thread-loader
    const workerPoolSize = Math.max(1, os.cpus().length - 1);

    // Create a configuration for each locale
    return Object.keys(locale).map((lang, index) => {
        const globals = {
            lang: lang,
            locale: langToLocale(lang),
            urlGenerator: page => urlGenerator(lang, page),
            urlGeneratorLang: urlGenerator
        };

        // Assign unique ports for each language configuration
        const port = 8080 + index;  // e.g., 8080 for fr, 8081 for en, etc.

        return {
            name: `config-${lang}`, // Unique name for each configuration
            mode: isProduction ? 'production' : 'development', // Explicit mode setting
            devtool: isProduction ? false : 'eval-cheap-module-source-map', // Plus rapide que eval-source-map
            entry: {
                geneafan: './assets/geneafan.js',
                embed: './assets/scripts/embed/embed.js'
            },
            output: {
                path: path.resolve(__dirname, 'dist'),
                filename: (pathData) => {
                    return pathData.chunk.name === 'embed'
                        ? './embed.js'
                        : './js/[name].bundle.[contenthash].js';
                },
                globalObject: 'self',
                publicPath: process.env.USE_APP_PREFIX ? '/app/' : '/'
            },
            
            stats: {
                errorDetails: true,
                children: true,
                performance: false,
                moduleTrace: false,
                warningsFilter: /exceeded the size limit/
            },

            // Activer le cache pour accélérer les builds consécutifs
            cache: {
                type: 'filesystem',
                buildDependencies: {
                    config: [__filename],
                },
                name: `${lang}-cache`,
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
                        default: false,
                    },
                },
                minimize: isProduction,
                minimizer: [
                    new TerserPlugin({
                        parallel: true, // Activer la parallélisation
                        terserOptions: {
                            compress: {
                                drop_console: removeConsole,
                            },
                        },
                    }),
                    new CssMinimizerPlugin({
                        parallel: true, // Activer la parallélisation
                    }),
                ],
            },
            performance: {
                hints: false,
            },
            resolve: {
                // Ajouter des extensions à résoudre automatiquement
                extensions: ['.js', '.mjs', '.json'],
                
                // Limiter la recherche de modules aux répertoires essentiels
                modules: [path.resolve(__dirname, 'node_modules')],
                
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
            // Webpack Dev Server configuration
            devServer: {
                static: path.join(__dirname, 'dist'),
                port: port,
                open: true,
                hot: true,
                client: {
                    logging: 'info',
                    overlay: {
                        errors: true,
                        warnings: false
                    }
                },
            },
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: /node_modules\/(lodash|fontkit)/,
                        use: [
                            // Paralléliser avec thread-loader
                            {
                                loader: 'thread-loader',
                                options: {
                                    workers: workerPoolSize,
                                }
                            },
                            // Utiliser esbuild-loader au lieu de babel-loader
                            esbuildConf
                        ]
                    },
                    {
                        test: /\.js$/,
                        include: /(pdfkit|saslprep|unicode-trie|unicode-properties|dfa|linebreak|panzoom)/,
                        use: [
                            {
                                loader: 'thread-loader',
                                options: {
                                    workers: workerPoolSize,
                                }
                            },
                            // Pour ces modules spécifiques, garder babel si nécessaire
                            // ou essayer esbuild si compatible
                            babelConf
                        ]
                    },
                    {
                        test: /\.mjs$/,
                        include: /node_modules/,
                        type: 'javascript/auto',
                        use: esbuildConf // Utiliser esbuild pour .mjs aussi
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
                            minimize: false,
                        },
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.(css|sass|scss)$/,
                        use: [
                            MiniCssExtractPlugin.loader,
                            {
                                loader: 'css-loader',
                                options: {
                                    importLoaders: 2,
                                }
                            },
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
                            // N'utiliser image-webpack-loader qu'en production
                            ...(isProduction ? [{
                                loader: 'image-webpack-loader',
                                options: {
                                    mozjpeg: {
                                        progressive: true,
                                        quality: 75
                                    },
                                },
                            }] : [])
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
                        use: ['style-loader', 'css-loader']
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
                    },
                    {
                        test: /\.svg$/,
                        use: [
                            {
                                loader: 'file-loader',
                                options: {
                                    outputPath: 'images/icons',
                                    name: '[name].[ext]',
                                },
                            },
                            ...(isProduction ? [{
                                loader: 'image-webpack-loader',
                                options: {
                                    mozjpeg: {
                                        progressive: true,
                                        quality: 75
                                    },
                                },
                            }] : [])
                        ],
                    },
                ]
            },
            plugins: [
                new webpack.ProgressPlugin({
                    percentBy: 'entries', // Plus précis pour voir la progression
                }),
                
                // Charge les variables d'environnement
                new Dotenv({
                    path: isProduction ? './.env.production' : './.env.development',
                    safe: false,
                }),
                
                // Plugins HTML
                new HtmlWebpackPlugin({
                    template: './assets/html/index.ejs',
                    templateParameters: globals,
                    filename: pageUrl(lang, 'index.html'),
                    chunks: ['geneafan', 'commons', 'i18n'],
                    hash: true,
                }),
                new HtmlWebpackPlugin({
                    template: './assets/html/embed/index.html',
                    filename: 'embed/index.html',
                    chunks: ['embed'],
                    hash: true,
                    inject: false,
                }),
                
                // Extraction CSS
                new MiniCssExtractPlugin({
                    filename: './css/[name].css'
                }),
                
                // Manifest pour asset management
                new WebpackManifestPlugin({
                    fileName: 'asset-manifest.json',
                    publicPath: 'dist/'
                }),
                
                // Fournir des modules globalement
                new webpack.ProvidePlugin({
                    Buffer: ['buffer', 'Buffer'],
                    process: 'process/browser',
                }),
                
                // Définir des variables globales
                new webpack.DefinePlugin({
                    'process.env.NODE_ENV': JSON.stringify(argv.mode),
                    'process.env.REMOVE_CONSOLE': JSON.stringify(removeConsole),
                }),
                
                // String replacement pour corriger des problèmes de compatibilité
                new StringReplacePlugin(),
                
                // Internationalisation
                new I18nPlugin(locale[lang], { nested: true }),

                new NodePolyfillPlugin(),
                
                // Analyser le bundle si demandé
                ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []),
            ]
        };
    });
};