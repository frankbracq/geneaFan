
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

// Déterminer le nombre optimal de workers pour thread-loader
const cpuCount = os.cpus().length;
const workerPoolSize = Math.max(1, cpuCount - 1);

// Configuration pour les workers partagés
const threadLoaderOptions = {
    workers: workerPoolSize,
    poolTimeout: 2000, // Conservez le pool plus longtemps en développement
    workerParallelJobs: 50,
    workerNodeArgs: ['--max-old-space-size=4096'], // Augmenter la mémoire allouée
};

// Fonction pour créer différentes instances de TerserPlugin
const createTerserPlugin = (test, options = {}) => {
    return new TerserPlugin({
        test,
        parallel: true,
        extractComments: false,
        terserOptions: {
            compress: {
                drop_console: options.removeConsole || false,
                ...options.compress
            },
            mangle: {
                safari10: true,
                ...options.mangle
            },
            format: {
                comments: false,
                ...options.format
            },
            sourceMap: true,
            ...options.terserOptions
        }
    });
};

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    // Chargez dotenv ici, avec accès à argv
    require('dotenv').config({
        path: isProduction ? './.env.production' : './.env.development'
    });

    // Récupérez la variable d'environnement après avoir chargé dotenv
    const removeConsole = process.env.REMOVE_CONSOLE === 'true';
    console.log('removeConsole setting:', removeConsole);

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
            devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map', // Source maps pour production
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
                publicPath: process.env.USE_APP_PREFIX ? '/genealogie.app/' : '/'
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
                compression: 'gzip', // Compresser le cache
                cacheDirectory: path.resolve(__dirname, '.webpack-cache'), // Emplacement personnalisé
                idleTimeoutForInitialStore: 0, // Pas de timeout pour le stockage initial
            },

            optimization: {

                splitChunks: {
                    chunks: 'all',
                    minSize: 20000,
                    maxSize: 200000,
                    // Augmenter le nombre maximal de fichiers parallèles par page
                    maxInitialRequests: 30,
                    // Augmenter le nombre maximal de fichiers asynchrones
                    maxAsyncRequests: 30,
                    cacheGroups: {
                        // Séparer les frameworks majeurs en chunks dédiés
                        react: {
                            test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
                            name: 'framework-react',
                            chunks: 'all',
                            priority: 40,
                            reuseExistingChunk: true,
                        },
                        // Si vous utilisez d'autres frameworks, vous pouvez créer des chunks dédiés
                        // Par exemple pour lodash
                        lodash: {
                            test: /[\\/]node_modules[\\/](lodash|lodash-es)[\\/]/,
                            name: 'utility-lodash',
                            chunks: 'all',
                            priority: 30,
                            reuseExistingChunk: true,
                        },
                        // Autres librairies courantes
                        vendors: {
                            test: /[\\/]node_modules[\\/]/,
                            name: 'vendors',
                            chunks: 'all',
                            priority: -10,
                            reuseExistingChunk: true,
                        },
                        // Extraire les modules de grande taille dans des chunks séparés
                        largeModules: {
                            test: module => {
                                return module.size() > 160000 &&
                                    (module.nameForCondition() && !module.nameForCondition().includes('node_modules'));
                            },
                            name(module) {
                                // Générer un nom basé sur le module pour éviter les collisions
                                const moduleFileName = module.nameForCondition()
                                    ? module.nameForCondition().split('/').slice(-2).join('~')
                                    : 'large';
                                return `large-modules/${moduleFileName}`;
                            },
                            chunks: 'all',
                            minSize: 120000,
                            priority: 20,
                            reuseExistingChunk: true,
                            enforce: true,
                        },
                        // Code partagé entre plusieurs parties de l'application
                        commons: {
                            name: 'commons',
                            minChunks: 2,
                            priority: 10,
                            reuseExistingChunk: true,
                            enforce: true,
                        },
                        // CSS dans des fichiers séparés
                        styles: {
                            name: 'styles',
                            test: /\.css$/,
                            chunks: 'all',
                            enforce: true,
                            priority: 50,
                        },
                        default: false,
                    },
                },
                minimize: isProduction,
                minimizer: [
                    // Configuration pour le code applicatif principal
                    createTerserPlugin(/\.js$/i, {
                        removeConsole,
                        compress: {
                            pure_funcs: removeConsole ? ['console.log', 'console.info', 'console.debug'] : [],
                            passes: 2, // Multiple passes pour une meilleure minification
                            toplevel: true, // Autorise les optimisations de niveau supérieur
                            unsafe_math: true, // Optimisations mathématiques plus agressives
                            unsafe_methods: true,
                            unsafe_proto: true
                        },
                        mangle: {
                            safari10: true,
                            reserved: ['process', 'require', '__webpack_require__']
                        },
                        format: {
                            ascii_only: true,
                        },
                        terserOptions: {
                            ecma: 2015,
                            keep_classnames: false,
                            keep_fnames: false,
                            ie8: false,
                            safari10: true,
                        }
                    }),

                    // Configuration plus légère pour les vendors
                    createTerserPlugin(/[\\/]node_modules[\\/].+\.js$/i, {
                        removeConsole: false, // Ne pas supprimer console.log des modules externes
                        compress: {
                            passes: 1, // Moins de passes pour les modules tiers
                            pure_funcs: [],
                            toplevel: false,
                            unsafe_math: false,
                        }
                    }),

                    // Configuration CSS
                    new CssMinimizerPlugin({
                        parallel: true,
                        minimizerOptions: {
                            preset: [
                                'default',
                                {
                                    discardComments: { removeAll: true },
                                    normalizeWhitespace: true
                                }
                            ]
                        }
                    }),
                ],
                // Optimisations additionnelles
                nodeEnv: isProduction ? 'production' : 'development',
                flagIncludedChunks: isProduction,
                sideEffects: isProduction,
                usedExports: isProduction,
                concatenateModules: isProduction,
                emitOnErrors: !isProduction,
                checkWasmTypes: isProduction,
                mangleExports: isProduction ? 'size' : false,
                moduleIds: isProduction ? 'deterministic' : 'named',
                chunkIds: isProduction ? 'deterministic' : 'named',
                providedExports: true
            },
            performance: {
                hints: false,
            },
            resolve: {
                // Ajouter des extensions à résoudre automatiquement
                extensions: ['.js', '.mjs', '.json'],

                // Limiter la recherche de modules aux répertoires essentiels
                modules: [path.resolve(__dirname, 'node_modules')],

                alias: {
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
                                options: threadLoaderOptions
                            },
                            // Utiliser esbuild-loader au lieu de babel-loader
                            esbuildConf
                        ]
                    },
                    {
                        test: /\.mjs$/,
                        include: /node_modules/,
                        type: 'javascript/auto',
                        use: esbuildConf // Utiliser esbuild pour .mjs aussi
                    },
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
                                    sourceMap: true
                                }
                            },
                            {
                                loader: 'resolve-url-loader',
                                options: {
                                    sourceMap: true
                                }
                            },
                            {
                                loader: 'postcss-loader',
                                options: {
                                    sourceMap: true
                                }
                            },
                            {
                                loader: 'sass-loader',
                                options: {
                                    sourceMap: true
                                }
                            }
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
                    filename: './css/[name].css',
                    chunkFilename: './css/[id].css',
                    ignoreOrder: false,
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
                }),

                // String replacement pour corriger des problèmes de compatibilité
                new StringReplacePlugin(),

                // Internationalisation
                new I18nPlugin(locale[lang], { nested: true }),

                // Source maps pour production
                ...(isProduction ? [
                    new webpack.SourceMapDevToolPlugin({
                        filename: '[file].map',
                        // Optionnel: exclure les vendor chunks si nécessaire
                        exclude: ['vendors', 'commons'],
                    })
                ] : []),

                // Analyser le bundle si demandé
                ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []),

                // Monitoring des performances webpack
                {
                    apply: (compiler) => {
                        let startTime = Date.now();
                        compiler.hooks.beforeCompile.tap('PerformanceMonitor', () => {
                            startTime = Date.now();
                            console.log('Compilation started...');
                        });

                        compiler.hooks.afterCompile.tap('PerformanceMonitor', (compilation) => {
                            const duration = (Date.now() - startTime) / 1000;
                            console.log(`Compilation finished in ${duration.toFixed(2)}s`);

                            // Analyser la taille des chunks après minification
                            const totalSize = Object.keys(compilation.assets)
                                .reduce((total, asset) => {
                                    const size = compilation.assets[asset].size();
                                    return total + size;
                                }, 0);

                            console.log(`Total bundle size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
                        });
                    }
                }
            ]
        };
    });
};