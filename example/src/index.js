exports.main_handler = async (event, context) => {
  console.log(event)
  return {
    msg: 'Hello Serverless'
  }
}
