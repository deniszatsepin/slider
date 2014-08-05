/**
 * Author: Denis Zatsepin
 * Email: denis@zatsepin.spb.ru
 * Date: 18.11.13
 * Time: 0:40
 */
module.exports = function(grunt) {

  grunt.initConfig({
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        eqnull: true,
        laxcomma: true,
        node: true,
        devel: true,
        globals: {
          jQuery: true
        },
      },

      all: ['Gruntfile.js', 'src/**/*.js']
    },
    coffee: {
      glob_to_multiple: {
        expand: true,
        flatten: true,
        cwd: 'src',
        src: ['*.coffee'],
        dest: '.tmp/js',
        ext: '.js'
      }
    },
    // Configure a mochaTest task
    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['test/**/*.js']
      }
    },

    copy: {
      main: {
        files: [
          {expand: true, cwd: 'bower_components/lodash/dist/', src: ['lodash.js'], dest: 'js/lib/'},
          {expand: true, cwd: 'bower_components/jquery/dist/', src: ['jquery.js'], dest: 'js/lib/'},
          {expand: true, cwd: 'bower_components/handlebars/', src: ['handlebars.js'], dest: 'js/lib/'},
          {expand: true, cwd: '.tmp/js/', src: ['*.js'], dest: 'js/'}
        ]
      }
    }
  });

  // Add the tasks here.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-coffee');

  grunt.registerTask('hint', 'jshint');
  grunt.registerTask('test', ['mochaTest']);

  grunt.registerTask('default', ['hint', 'coffee', 'test', 'copy']);
};