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

// Function to map language to locale format
function langToLocale(lang) {
    return lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : null;
}

// Function to generate the full URL for a page
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
                // Remove console.log statements in production
                ...(isProduction ? ['transform-remove-console'] : []),
            ],
        }
    };
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
            devtool: isProduction ? false : 'eval-source-map', // Disable source maps in production
            entry: {
                geneafan: './assets/geneafan.js', // Entry point for the application
            },
            output: {
                path: path.resolve(__dirname, 'dist'), // Output directory
                filename: './js/[name].bundle.[contenthash].js', // Bundle output with hash
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
                        default: false, // Disable default chunk group to avoid conflicts
                    },
                },
                minimize: isProduction, // Minimize assets in production
                minimizer: [
                    new TerserPlugin({
                        terserOptions: {
                            compress: {
                                drop_console: isProduction, // Remove console logs in production
                            },
                        },
                        parallel: true, // Enable parallel minification
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
            // Webpack Dev Server configuration
            devServer: {
                static: path.join(__dirname, 'dist'), // Serve static files from dist folder
                port: port,  // Use a different port for each locale
                open: true,  // Automatically open the app in the default browser
                hot: true,  // Enable Hot Module Replacement (HMR)
                client: {
                    logging: 'info',  // Show logs in the browser console
                },
            },
            module: {
                rules: [
                    {
                        test: /\.js$/, // JavaScript files
                        exclude: /node_modules\/(lodash|@clerk\/clerk-js|fontkit)/, // Exclude specific modules
                        use: babelConf
                    },
                    {
                        test: /\.js$/,
                        include: /(pdfkit|saslprep|unicode-trie|unicode-properties|dfa|linebreak|panzoom)/,
                        use: babelConf
                    },
                    {
                        test: /\.mjs$/, // Support for .mjs files
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
                    { test: /src[/\\]assets/, loader: 'arraybuffer-loader' }, // Load arraybuffer
                    { test: /\.afm$/, loader: 'raw-loader' }, // Load raw files (fonts)
                    {
                        test: /\.(html)$/, // HTML loader
                        loader: 'html-loader',
                        options: {
                            interpolate: true,
                            minimize: false, // Do not minimize HTML
                        },
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.(css|sass|scss)$/, // CSS, Sass, and SCSS files
                        use: [
                            MiniCssExtractPlugin.loader, // Extract CSS into files
                            'css-loader',
                            'resolve-url-loader',
                            'postcss-loader',
                            'sass-loader'
                        ],
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.(jpe?g|png|gif|svg)$/, // Image files
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
                                    disable: !isProduction, // Disable in development
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
                        test: /(favicon\.ico|site\.webmanifest|manifest\.json|browserconfig\.xml|robots\.txt|humans\.txt)$/, // Handle various assets
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                        },
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.(woff(2)?|ttf|eot)(\?[a-z0-9=.]+)?$/, // Font files
                        loader: 'file-loader',
                        options: {
                            outputPath: 'fonts',
                            name: '[name].[ext]',
                        },
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.css$/, // CSS from node_modules
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
                                        pattern: /trimLeft\(\)/ig, // Replace deprecated trimLeft with trim
                                        replacement: () => 'trim()'
                                    }
                                ]
                            })
                        }
                    }
                ],
            },
            plugins: [
                new webpack.ProgressPlugin(), // Show progress bar during build
                new Dotenv({
                    path: isProduction ? './.env.production' : './.env.development', // Load environment variables
                    safe: false,
                }),
                new HtmlWebpackPlugin({
                    template: './assets/html/index.ejs', // Template for HTML file
                    templateParameters: globals,
                    filename: pageUrl(lang, 'index.html'),
                    chunks: ['geneafan', 'commons', 'i18n'],
                    hash: true,
                }),
                new MiniCssExtractPlugin({
                    filename: './css/[name].css' // Output CSS filename
                }),
                new WebpackManifestPlugin({
                    fileName: 'asset-manifest.json', // Generate manifest file
                    publicPath: 'dist/'
                }),
                new webpack.ProvidePlugin({
                    Buffer: ['buffer', 'Buffer'], // Provide Buffer globally
                }),
                new webpack.DefinePlugin({
                    'process.env.NODE_ENV': JSON.stringify(argv.mode), // Define environment mode
                }),
                new StringReplacePlugin(), // Replace strings in files
                new I18nPlugin(locale[lang], { nested: true }), // Internationalization plugin
                new webpack.ProvidePlugin({
                    process: 'process/browser', // Provide browser process object
                }),
                ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []), // Analyze bundle if requested
            ]
        };
    });
};