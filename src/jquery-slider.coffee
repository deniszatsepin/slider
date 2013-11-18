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
        url: 'img/loading.gif'
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
    if typeof next isnt 'undefined'
      @current = if next < @images.length then next else @current
    else
      @current = if @current == @images.length - 1 then 0 else @current + 1

    if @prev isnt @current
      @observable.publish 'next',
        next: @current
        prev: @prev

  setPrev: (prev) ->
    @prev = @current
    if typeof prev isnt 'undefined'
      @current = if prev >= 0 then prev else @current
    else
      @current = if @current == 0 then @images.length - 1 else @current - 1

    if @prev isnt @current
      @observable.publish 'prev',
        next: @current
        prev: @prev

  setSlide: (nr) ->
    return if typeof nr == 'undefined'
    if @current > nr
      @setPrev nr
    else
      @setNext nr

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
  constructor: (@root, @model) ->
    @view = new View(@root, $('#z-slider-nav-tmpl'))
    @commands = []
    @max = 20
    @animating = false

    @onSourceChanged 'source', @model.images

    @loopId = setInterval $.proxy(() ->
      @loop()
    , @), 100

    @model.subscribe 'source', $.proxy(@onSourceChanged, @)
    @model.subscribe 'next', $.proxy(@onNextEvent, @)
    @model.subscribe 'prev', $.proxy(@onPrevEvent, @)
    @model.subscribe 'loaded', $.proxy(@onImageLoaded, @)

    @root.on 'click', '[data-action="line-left"]', $.proxy(@onLeftClick, @)
    @root.on 'click', '[data-action="line-right"]', $.proxy(@onRightClick, @)
    @root.on 'click', '[data-action="slide-set"]', $.proxy(@onSlideSet, @)


  onSourceChanged: (event, data) ->
    @view.render
      images: data
    @navWidth = $('section.thumbs', @root).width()
    @thumbLine = $('section.thumbs .thumbs-line', @root)
    @thumbs = $('.thumb-wrap', @thumbLine)
    @elWidth = $(@thumbs[0]).width()
    @thumbLine.width(@elWidth * @thumbs.length)
    $(@thumbs[0]).addClass 'active'

  onImageLoaded: (event, pos) ->
    thumbWrp = @thumbs[pos]
    $thumb = $('.thumb', thumbWrp)
    $thumb.css('background-image', 'url(' + @model.images[pos].src + ')')

  onLeftClick: (e) ->
    left = parseInt(@thumbLine.css('left')) or 0
    right = @thumbLine.width() - Math.abs(left)
    return if right <= @navWidth
    after = right - @navWidth
    toMove = if after >= @navWidth then @navWidth else after
    @commands.push
      command: 'moveLeft'
      distance: toMove

  onRightClick: (e) ->
    left = parseInt(@thumbLine.css('left')) or 0
    return if left >= 0
    left = Math.abs left
    toMove = if left >= @navWidth then @navWidth else left
    @commands.push
      command: 'moveRight'
      distance: toMove

  onSlideSet: (e) ->
    idx = parseInt e.target.getAttribute('data-index')
    @model.setSlide(idx)


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
    $from = $(@thumbs[data.prev])
    $to = $(@thumbs[data.next])
    $from.removeClass 'active'
    $to.addClass 'active'

    left = parseInt(@thumbLine.css('left')) or 0

    if data.next == 0
      @navLeft
        distance: left
      return

    right = @thumbLine.width() - Math.abs(left)
    shouldLeft = (data.next + 1) * @elWidth
    if shouldLeft > Math.abs(left) + @navWidth
      delta = shouldLeft - (left + @navWidth)
      toMove = if delta > right - @navWidth then right - @navWidth else delta
      @navLeft
        distance: toMove
    else
      @animating = false

  prevSlide: (data) ->
    $from = $(@thumbs[data.prev])
    $to = $(@thumbs[data.next])
    $from.removeClass 'active'
    $to.addClass 'active'

    left = parseInt(@thumbLine.css('left')) or 0
    delta = @thumbLine.width() - @navWidth
    if data.next == @thumbs.length - 1
      @navLeft
        distance: if delta > 0 then delta else 0

    right = @thumbLine.width() - Math.abs(left)
    shouldLeft = data.next * @elWidth

    if shouldLeft < Math.abs(left)
      delta = Math.abs(left) - shouldLeft
      @navRight
        distance: delta
    else
      @animating = false

  navLeft: (data) ->
    @thumbLine.animate
      left: '-=' + data.distance
    ,
      complete: $.proxy( ->
        @animating = false
      , @)

  navRight: (data) ->
    @thumbLine.animate
      left: '+=' + data.distance
    ,
      complete: $.proxy( ->
        @animating = false
      , @)

  loop: () ->
    if @animating
      return

    if @commands.length
      command = @commands.shift()

      switch command.command
        when 'next'
          @animating = true
          @nextSlide command
        when 'prev'
          @animating = true
          @prevSlide command
        when 'moveLeft'
          @animating = true
          @navLeft command
        when 'moveRight'
          @animating = true
          @navRight command

class SliderController
  constructor: (@root, @model) ->
    @view = new View(@root, $('#z-slider-figure-tmpl'))
    @$root = @root;
    @commands = []
    @max = 20
    @animating = false
    @order = []

    @onSourceChanged 'source', @model.images

    @loopId = setInterval $.proxy(() ->
      @loop()
    , @), 100

    @model.subscribe 'source', $.proxy(@onSourceChanged, @)
    @model.subscribe 'next', $.proxy(@onNextEvent, @)
    @model.subscribe 'prev', $.proxy(@onPrevEvent, @)
    @model.subscribe 'loaded', $.proxy(@onImageLoaded, @)

    @root.on 'click', '[data-action="slide-next"]', $.proxy((e) ->
      @onNextClick()
    , @)
    @root.on 'click', '[data-action="slide-prev"]', $.proxy((e) ->
      @onPrevClick()
    , @)

  setVisibility: ->
    @ordered = []
    $images = $('div.slides > div', @root)
    for img in $images
      @ordered.push img
      img.style.display = 'none' if _i > 0

  onSourceChanged: (event, data) ->
    @view.render
      images: data
    @setVisibility()

  onImageLoaded: (event, pos) ->
    wrp = @ordered[pos]
    $img = $('img', wrp)
    $img.attr('src', @model.images[pos].src)

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
    from = @ordered[data.prev]
    to = @ordered[data.next]

    SlideChanger['simple'].call(@, from, to)

  prevSlide: (data) ->
    from = @ordered[data.prev]
    to = @ordered[data.next]

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
    carouselController = new CarouselController(nav, model)

    $(@).zpresenter =
      setSource: (src) ->
        model.setSource src
    @


