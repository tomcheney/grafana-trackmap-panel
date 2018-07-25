module.exports = (grunt) => {
  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-execute');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.initConfig({

    clean: ['dist'],

    copy: {
      src_to_dist: {
        cwd: 'src',
        expand: true,
        src: ['**/*', '!**/*.js', '!**/*.scss'],
        dest: 'dist'
      },
      pluginDef: {
        expand: true,
        src: ['README.md'],
        dest: 'dist'
      },
      leaflet: {
        cwd: 'node_modules/leaflet/dist/',
        expand: true,
        src: ['leaflet.js', 'leaflet.css', 'images'],
        dest: 'dist/leaflet'
      },
      leafletRotatedMarker: {
          cwd: 'node_modules/leaflet-rotatedmarker/',
          expand: true,
          src: ['leaflet.rotatedMarker.js'],
          dest: 'dist/leaflet'
      },
      leaflet_img: {
        cwd: 'node_modules/leaflet/dist/images',
        expand: true,
        src: ['layers-2x.png', 'layers.png'],
        dest: 'dist/leaflet/images/'
      },
      custom_img: {
        cwd: 'src/img',
        expand: true,
        src: ['marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png'],
        dest: 'dist/leaflet/images/'
      }
    },

    watch: {
      rebuild_all: {
        files: ['src/**/*', 'README.md'],
        tasks: ['default'],
        options: {
          spawn: false
        }
      },
    },

    babel: {
      options: {
        sourceMap: true,
        presets: ['es2015'],
        plugins: ['transform-es2015-modules-systemjs', 'transform-es2015-for-of'],
      },
      dist: {
        files: [{
          cwd: 'src',
          expand: true,
          src: ['*.js'],
          dest: 'dist',
          ext: '.js',
        }]
      },
    },

  });

  grunt.registerTask('default', ['clean', 'copy', 'babel']);
};
