class Observable
  constructor: (id) ->
    @listeners = {}
    @getId = () ->
      id += 1

  publish: (event, data) ->
    return if not @listeners[event]

    for handler in @listeners[event]
      handler.cb.apply null, [event, data]

  subscribe: (event, cb) ->
    return if typeof cb isnt 'function'
    @listeners[event] = @listeners[event] or []

    id = @getId()
    @listeners[event].push
      id: id
      cb: cb
    id

  unsubscribe: (event, id) ->
    return if not @listeners[event]
    for handler in @listeners[event]
      if handler.id == id
        @listeners[event].splice _i, 1
        return true
    return false

SlideChanger =
  simple: (firstSlide, secondSlide, back) ->
    $first = $(firstSlide)
    $second = $(secondSlide)
    width = @$root.width();

    if back
      $second.insertBefore $first
      $first.css('top', '0px').css('left', '0px')
      $second.css('top', '0px').css('left', '-' + width + 'px')
    else
      $second.insertAfter $first
      $first.css('top', '0px').css('left', '0px')
      $second.css('top', '0px').css('left', width + 'px')


    $first.css('display','block')
    $second.css('display', 'block')

    if back
      $first.animate
        left: '+=' + width

      $second.animate
        left: '+=' + width
      ,
        complete: $.proxy(($first) ->
          @animating = false
          $first.css('display', 'none')
        , @, $first)
    else
      $first.animate
        left: '-=' + width

      $second.animate
        left: '-=' + width
      ,
        complete: $.proxy(($first) ->
          @animating = false
          $first.css('display', 'none')
        , @, $first)

    undefined


class Model
  constructor: (images) ->
    @images = []
    @current = 0
    @prev = 0
    @observable = new Observable()
    if images
      @changeSource images

  changeSource: (images) ->
    @images = []
    @current = 0
    @prev = 0
    _.forEach images, (img, pos) ->
      image =
        src: img.url
        img: new Image()
        loaded: false
        pos: pos

      image.img.src = image.src
      $(image.img).load image, $.proxy((e) ->
        e.handleObj.data.loaded = true
        @observable.publish 'loaded', e.handleObj.data.pos
      , @)

      @images.push image
    , @

    @observable.publish 'source', @images

  setNext: (next) ->
    @prev = @current
    if next
      @current = if next < @images.length then next else @current
    else
      @current = if @current == @images.length - 1 then 0 else @current + 1

    if @prev isnt @current
      @observable.publish 'next',
        next: @current
        prev: @prev

  setPrev: () ->
    @prev = @current
    @current = if @current == 0 then @images.length - 1 else @current - 1
    @observable.publish 'next',
      next: @current
      prev: @prev

  subscribe: (event, cb) ->
    @observable.subscribe event, cb

  unsubscribe: (event, id) ->
    @observable.unsubscribe event, id


class View
  constructor: (@root, tmpl) ->
    source = tmpl.html();
    @template = Handlebars.compile source

  render: (data) ->
    html = @template data
    @root.append html



class CarouselController
  constructor: () ->
    @observable = new Observable()
    @model = new Model()

    @view = new View()

class SliderController
  constructor: (@root, @model) ->
    @view = new View(@root, $('#z-slider-figure-tmpl'))
    @$root = @root;
    @commands = []
    @max = 20
    @animating = false

    @onSourceChanged 'source', @model.images

    @loopId = setInterval $.proxy(() ->
      @loop()
    , @), 1000

    @model.subscribe 'source', $.proxy(@onSourceChanged, @)
    @model.subscribe 'next', $.proxy(@onNextEvent, @)
    @model.subscribe 'prev', $.proxy(@onPrevEvent, @)

    @root.on 'click', '[data-action="slide-next"]', $.proxy((e) ->
      @onNextClick()
    , @)
    @root.on 'click', '[data-action="slide-prev"]', $.proxy((e) ->
      @onPrevClick()
    , @)

  setVisibility: ->
    $images = $('div.slides > div', @root)
    for img in $images
      img.style.display = 'none' if _i > 0

  onSourceChanged: (event, data) ->
    @view.render
      images: data
    @setVisibility()

  onNextClick: ->
    @model.setNext()

  onPrevClick: ->
    @model.setPrev()


  onNextEvent: (event, data) ->
    if @commands.length < @max
      @commands.push
        command: 'next'
        prev: data.prev
        next: data.next

  onPrevEvent: (event, data) ->
    if @commands.length < @max
      @commands.push
        command: 'prev'
        prev: data.prev
        next: data.next


  nextSlide: (data) ->
    slides = $('div.slides > div', @root)
    from = slides[data.prev]
    to = slides[data.next]

    SlideChanger['simple'].call(@, from, to)

  prevSlide: (data) ->
    slides = $('div.slides > div', @root)
    from = slides[data.prev]
    to = slides[data.next]

    SlideChanger['simple'].call(@, from, to, true)


  loop: () ->
    if @animating
      return

    if @commands.length
      command = @commands.shift()

      switch command.command
        when 'next'
          @nextSlide command
          @animating = true;
        when 'prev'
          @prevSlide command
          @animating = true;



$.fn.zslider = (options) ->
  defaults =
    controls: 'bottom'
    slide: 'simple'

  settings = $.extend {}, defaults, options

  @each () ->
    console.log('args: ', arguments)
    model = new Model(settings.images)
    container = $('<section class="z-slider-container"></section>')
    container.appendTo @
    figure = $('<figure></figure>')
    figure.appendTo container
    nav = $('<nav></nav>')
    nav.appendTo container

    sliderController = new SliderController(figure, model)
    #carouselController = new CarouselController(nav, model)

    $(@).zpresenter =
      setSource: (src) ->
        model.setSource src
    @


